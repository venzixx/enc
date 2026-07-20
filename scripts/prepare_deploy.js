const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
    console.log('Gathering modified and untracked files...');
    
    // 1. Root files (bot)
    const rootModified = execSync('git diff --name-only', { encoding: 'utf8' })
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
        
    const rootUntracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' })
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
        
    // 2. Dashboard files
    const dashboardModified = execSync('git diff --name-only', { cwd: 'dashboard', encoding: 'utf8' })
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(file => `dashboard/${file}`);
        
    const dashboardUntracked = execSync('git ls-files --others --exclude-standard', { cwd: 'dashboard', encoding: 'utf8' })
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(file => `dashboard/${file}`);
        
    // Combine all
    const allFiles = [...new Set([
        ...rootModified,
        ...rootUntracked,
        ...dashboardModified,
        ...dashboardUntracked
    ])];
    
    // 3. Filter files
    const excludePatterns = [
        /\.tar\.gz$/,
        /\.zip$/,
        /\.db$/,
        /\.sqlite$/,
        /\.env/,
        /^app\//,  // Exclude redundant app/ folder
        /^prisma\/backups\//,
        /files_to_compress\.txt/,
        /prepare_deploy\.js/,
        /^dashboard$/, // Do NOT include the folder itself
        /^dashboard\/node_modules\//,
        /^dashboard\/\.next\//
    ];
    
    const filteredFiles = allFiles.filter(file => {
        // Exclude matched patterns
        for (const pattern of excludePatterns) {
            if (pattern.test(file)) {
                return false;
            }
        }
        // Make sure file exists and is not a directory
        if (!fs.existsSync(file)) {
            return false;
        }
        const stats = fs.statSync(file);
        if (stats.isDirectory()) {
            return false; // Skip directory entries themselves (we list their files instead)
        }
        return true;
    });
    
    console.log(`Found ${filteredFiles.length} files to pack.`);
    
    // Write to files_to_compress.txt
    fs.writeFileSync('files_to_compress.txt', filteredFiles.join('\n'), 'utf8');
    console.log('Wrote files list to files_to_compress.txt');
    
} catch (error) {
    console.error('Error preparing deploy files list:', error);
    process.exit(1);
}
