import * as p from '@clack/prompts';
import pc from 'picocolors';
import { spawn } from 'child_process';
import { checkForUpdate } from '../utils/version-check.js';
import { getChannel, setChannel } from '../utils/config.js';
import { isInteractive } from '../utils/interactive.js';
/**
 * Parse --channel flag from args
 */
function parseChannelArg(args) {
    const channelIndex = args.findIndex(arg => arg === '--channel');
    if (channelIndex !== -1 && args[channelIndex + 1]) {
        const value = args[channelIndex + 1];
        if (value === 'dev' || value === 'latest') {
            return value;
        }
    }
    // Also support --channel=dev format
    const channelArg = args.find(arg => arg.startsWith('--channel='));
    if (channelArg) {
        const value = channelArg.split('=')[1];
        if (value === 'dev' || value === 'latest') {
            return value;
        }
    }
    return undefined;
}
/**
 * Run npm install to update the CLI
 */
function runNpmInstall(channel) {
    return new Promise((resolve) => {
        const packageSpec = `flight-rules@${channel}`;
        const npmProcess = spawn('npm', ['install', '-g', packageSpec], {
            stdio: ['inherit', 'pipe', 'pipe'],
            shell: true,
        });
        let stdout = '';
        let stderr = '';
        npmProcess.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        npmProcess.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        npmProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true });
            }
            else {
                resolve({
                    success: false,
                    error: stderr || stdout || `npm exited with code ${code}`
                });
            }
        });
        npmProcess.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}
export async function update(args = []) {
    const interactive = isInteractive();
    // Parse --channel flag
    const requestedChannel = parseChannelArg(args);
    const currentChannel = getChannel();
    const targetChannel = requestedChannel || currentChannel;
    // If switching channels, inform the user
    if (requestedChannel && requestedChannel !== currentChannel) {
        p.log.info(`Switching from ${pc.yellow(currentChannel)} to ${pc.cyan(requestedChannel)} channel.`);
    }
    // Check for updates (force fetch, bypass cache)
    const spinner = p.spinner();
    spinner.start('Checking for updates...');
    const result = await checkForUpdate({ force: true });
    if (!result) {
        spinner.stop('Unable to check for updates');
        p.log.error('Could not connect to npm registry. Check your network connection.');
        return;
    }
    spinner.stop('Version check complete');
    // Display version info
    p.log.info(`Current version: ${pc.cyan(result.currentVersion)}`);
    p.log.info(`Latest version (${targetChannel}): ${pc.cyan(result.latestVersion)}`);
    // Check if update is needed
    if (!result.updateAvailable && targetChannel === currentChannel) {
        p.log.success('You are already on the latest version!');
        p.outro(pc.green('No update needed.'));
        return;
    }
    // If only switching channels (no version change), still proceed
    const switchingChannels = requestedChannel && requestedChannel !== currentChannel;
    if (!result.updateAvailable && !switchingChannels) {
        p.log.success('You are already on the latest version!');
        p.outro(pc.green('No update needed.'));
        return;
    }
    // Non-interactive mode: show info but don't update
    if (!interactive) {
        if (result.updateAvailable) {
            p.log.info(`Update available: ${pc.yellow(result.currentVersion)} → ${pc.cyan(result.latestVersion)}`);
            p.log.message('Run this command in an interactive terminal to update.');
        }
        if (switchingChannels) {
            p.log.info(`Run this command in an interactive terminal to switch to the ${requestedChannel} channel.`);
        }
        return;
    }
    // Interactive mode: confirm and update
    const message = result.updateAvailable
        ? `Update from ${result.currentVersion} to ${result.latestVersion}?`
        : `Switch to ${targetChannel} channel?`;
    const shouldUpdate = await p.confirm({
        message,
        initialValue: true,
    });
    if (p.isCancel(shouldUpdate) || !shouldUpdate) {
        p.log.info('Update cancelled.');
        return;
    }
    // Perform update
    spinner.start(`Installing flight-rules@${targetChannel}...`);
    const installResult = await runNpmInstall(targetChannel);
    if (!installResult.success) {
        spinner.stop('Update failed');
        p.log.error(installResult.error || 'Unknown error during npm install');
        p.log.message(`You can try manually: ${pc.cyan(`npm install -g flight-rules@${targetChannel}`)}`);
        return;
    }
    spinner.stop('Update complete!');
    // Update channel in config if it changed
    if (requestedChannel && requestedChannel !== currentChannel) {
        setChannel(requestedChannel);
        p.log.success(`Channel set to ${pc.cyan(requestedChannel)}`);
    }
    p.outro(pc.green(`Successfully updated to flight-rules@${targetChannel}!`));
}
