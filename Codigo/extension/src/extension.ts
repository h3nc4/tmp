import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GITHUB_REPO = 'h3nc4/HookCI';
const BINARY_NAME = 'hookci';
const RELEASE_ASSET_NAME = 'hookci';
const INSTALL_DIR = path.join(os.homedir(), '.local', 'bin');
const BINARY_PATH = path.join(INSTALL_DIR, BINARY_NAME);

/**
 * The main entry point for the extension. This function is called when the
 * extension is activated.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Activating HookCI Installer extension.');

    try {
        await ensureHookciInstalled();
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
 * Checks if the hookci binary is installed globally, and if not, downloads it.
 */
async function ensureHookciInstalled(): Promise<void> {
    if (os.platform() !== 'linux') {
        vscode.window.showWarningMessage('HookCI Installer extension only supports Linux.');
        return;
    }

    try {
        await fsPromises.stat(BINARY_PATH);
        console.log(`HookCI binary already found at ${BINARY_PATH}.`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log('HookCI binary not found. Proceeding with installation.');
            await installHookci();
        } else {
            throw new Error(`Failed to check for hookci binary: ${error.message}`);
        }
    }
}

/**
 * Handles the full installation process including download and setting permissions.
 */
async function installHookci(): Promise<void> {
    const downloadUrl = `https://github.com/${GITHUB_REPO}/releases/latest/download/${RELEASE_ASSET_NAME}`;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Installing HookCI',
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: 'Creating installation directory...' });
            await fsPromises.mkdir(INSTALL_DIR, { recursive: true });

            progress.report({ message: `Downloading from ${downloadUrl}...` });
            await downloadFile(downloadUrl, BINARY_PATH);

            progress.report({ message: 'Setting permissions...' });
            await fsPromises.chmod(BINARY_PATH, 0o755); // rwxr-xr-x

            vscode.window.showInformationMessage('HookCI has been successfully installed.');
            console.log(`HookCI installed to ${BINARY_PATH}.`);
        }
    );
}

/**
 * Downloads a file from a URL to a destination path, handling HTTPS redirects.
 * @param url The URL to download from.
 * @param dest The local filesystem path to save the file to.
 */
function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const options: https.RequestOptions = {
            headers: {
                'User-Agent': 'vscode-hookci-installer-extension'
            }
        };

        const request = https.get(url, options, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                if (response.headers.location) {
                    return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                }
                return reject(new Error('Download failed: Redirect location missing.'));
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Download failed with status code: ${response.statusCode}`));
            }

            const fileStream = fs.createWriteStream(dest);
            response.pipe(fileStream);

            fileStream.on('finish', () => fileStream.close(() => resolve()));
            fileStream.on('error', (err: NodeJS.ErrnoException) => {
                fsPromises.unlink(dest).catch(() => { });
                reject(err);
            });
        });

        request.on('error', (err: Error) => reject(new Error(`Download request failed: ${err.message}`)));
    });
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