import { QuoteGenerator } from './utils/QuoteGenerator';
import fs from 'fs';

async function test() {
    try {
        const text = "Hello this is a test quote! It has some text and should wrap.";

        // Test light theme
        console.log("=== Testing LIGHT theme ===");
        const lightBuffer = await QuoteGenerator.generate(
            text, "@testuser", "Test Display Name",
            "https://cdn.discordapp.com/embed/avatars/0.png",
            { color: true, theme: 'light', reverse: false, blur: false, gif: false, font: 'Inter' }
        );
        fs.writeFileSync('test_light_final.png', lightBuffer);
        console.log("Saved test_light_final.png");

        // Test dark theme (should be unchanged)
        console.log("\n=== Testing DARK theme ===");
        const darkBuffer = await QuoteGenerator.generate(
            text, "@testuser", "Test Display Name",
            "https://cdn.discordapp.com/embed/avatars/0.png",
            { color: true, theme: 'dark', reverse: false, blur: false, gif: false, font: 'Inter' }
        );
        fs.writeFileSync('test_dark_final.png', darkBuffer);
        console.log("Saved test_dark_final.png");

        // Test light theme reversed
        console.log("\n=== Testing LIGHT theme REVERSED ===");
        const lightRevBuffer = await QuoteGenerator.generate(
            text, "@testuser", "Test Display Name",
            "https://cdn.discordapp.com/embed/avatars/0.png",
            { color: true, theme: 'light', reverse: true, blur: false, gif: false, font: 'Inter' }
        );
        fs.writeFileSync('test_light_reversed.png', lightRevBuffer);
        console.log("Saved test_light_reversed.png");

        // Test light theme with blur
        console.log("\n=== Testing LIGHT theme BLUR ===");
        const lightBlurBuffer = await QuoteGenerator.generate(
            text, "@testuser", "Test Display Name",
            "https://cdn.discordapp.com/embed/avatars/0.png",
            { color: true, theme: 'light', reverse: false, blur: true, gif: false, font: 'Inter' }
        );
        fs.writeFileSync('test_light_blur.png', lightBlurBuffer);
        console.log("Saved test_light_blur.png");

    } catch (err) {
        console.error("Error:", err);
    }
}

test();
