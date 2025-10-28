import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fsPromises from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

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
 * Checks if the hookci binary is installed globally, and if not, copies it
 * from the extension's bundle.
 * @param context The extension context, used to find the bundled binary's path.
 */
async function ensureHookciIsInstalled(context: vscode.ExtensionContext): Promise<void> {
    if (os.platform() !== 'linux') {
        vscode.window.showWarningMessage('HookCI Installer extension only supports Linux.');
        return;
    }

    try {
        await fsPromises.stat(BINARY_PATH);
        console.log(`HookCI binary already found at ${BINARY_PATH}. Skipping installation.`);
        return;
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            throw new Error(`Failed to check for hookci binary: ${error.message}`);
        }
        console.log('HookCI binary not found. Proceeding with installation from bundle.');
    }

    const bundledBinaryPath = path.join(context.extensionPath, BUNDLED_BINARY_DIR, BINARY_NAME);

    try {
        await fsPromises.stat(bundledBinaryPath);
    } catch (error) {
        throw new Error(`Bundled HookCI binary not found at ${bundledBinaryPath}. The extension package might be corrupted.`);
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

            vscode.window.showInformationMessage(`HookCI has been successfully installed to ${BINARY_PATH}.`);
            console.log(`HookCI installed to ${BINARY_PATH}.`);
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
