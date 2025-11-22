import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fsPromises from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

const BINARY_NAME = 'hookci';
const BUNDLED_BINARY_DIR = 'bin';
const INSTALL_DIR = path.join(os.homedir(), '.local', 'bin');
const BINARY_PATH = path.join(INSTALL_DIR, BINARY_NAME);

/**
 * The main entry point for the extension. This function is called when the
 * extension is activated.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Activating HookCI Installer extension.');

    try {
        await ensureHookciIsInstalled(context);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`HookCI installation failed: ${message}`);
        console.error('HookCI installation failed:', error);
        return;
    }

    await configureGitHooks();

    const disposable = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        console.log('Workspace folders changed, re-running HookCI hook configuration.');
        await configureGitHooks();
    });

    context.subscriptions.push(disposable);
}

/**
 * Calculates the SHA-256 checksum of a file.
 */
async function calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fsPromises.readFile(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Checks if the hookci binary is installed globally and up-to-date.
 * If missing or checksum mismatch, copies it from the extension's bundle.
 * @param context The extension context, used to find the bundled binary's path.
 */
async function ensureHookciIsInstalled(context: vscode.ExtensionContext): Promise<void> {
    if (os.platform() !== 'linux') {
        vscode.window.showWarningMessage('HookCI Installer extension only supports Linux.');
        return;
    }

    const bundledBinaryPath = path.join(context.extensionPath, BUNDLED_BINARY_DIR, BINARY_NAME);

    try {
        await fsPromises.stat(bundledBinaryPath);
    } catch (error) {
        throw new Error(`Bundled HookCI binary not found at ${bundledBinaryPath}. The extension package might be corrupted.`);
    }

    let shouldInstall = true;

    try {
        await fsPromises.stat(BINARY_PATH);

        // File exists, check integrity
        const currentChecksum = await calculateChecksum(BINARY_PATH);
        const bundledChecksum = await calculateChecksum(bundledBinaryPath);

        if (currentChecksum === bundledChecksum) {
            console.log(`HookCI binary at ${BINARY_PATH} is up to date. Skipping installation.`);
            shouldInstall = false;
        } else {
            console.log(`HookCI binary checksum mismatch (Installed: ${currentChecksum} vs Bundled: ${bundledChecksum}). Updating...`);
        }

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log('HookCI binary not found. Proceeding with installation from bundle.');
        } else {
            console.warn(`Failed to check status of ${BINARY_PATH}: ${error.message}. Proceeding with installation attempt.`);
        }
    }

    if (!shouldInstall) {
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Installing HookCI',
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: 'Creating installation directory...' });
            await fsPromises.mkdir(INSTALL_DIR, { recursive: true });

            progress.report({ message: `Copying binary to ${INSTALL_DIR}...` });
            await fsPromises.copyFile(bundledBinaryPath, BINARY_PATH);

            progress.report({ message: 'Setting file permissions...' });
            await fsPromises.chmod(BINARY_PATH, 0o755); // rwxr-xr-x

            const action = 'installed/updated';
            vscode.window.showInformationMessage(`HookCI has been successfully ${action} to ${BINARY_PATH}.`);
            console.log(`HookCI ${action} to ${BINARY_PATH}.`);
        }
    );
}


/**
 * Configures the local git repository in all open workspace folders to use
 * the HookCI hooks path.
 */
async function configureGitHooks(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        console.log('No workspace open. Skipping Git hooks configuration.');
        return;
    }

    for (const folder of workspaceFolders) {
        const workspaceRoot = folder.uri.fsPath;
        try {
            await execAsync('git rev-parse --is-inside-work-tree', { cwd: workspaceRoot });
            await execAsync('git config core.hooksPath .hookci/hooks', { cwd: workspaceRoot });
            console.log(`Successfully configured Git hooks path for: ${workspaceRoot}`);

        } catch (error: any) {
            if (error.stderr?.includes('not a git repository')) {
                console.log(`Skipping hook configuration for non-Git folder: ${workspaceRoot}`);
            } else {
                const message = error instanceof Error ? error.message : String(error);
                vscode.window.showWarningMessage(`Failed to configure HookCI hooks for '${folder.name}'.`);
                console.error(`Error configuring hooks for ${workspaceRoot}:`, message);
            }
        }
    }
}

/**
 * The deactivate function is called when the extension is deactivated.
 */
export function deactivate(): void { }
