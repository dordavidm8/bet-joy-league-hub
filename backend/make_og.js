const { execSync } = require('child_process');
const input = '/Users/nirdahan/.gemini/antigravity/brain/613645b4-0047-4c7b-9c3f-b8d91d35e207/kickoff_light_framed_icon_1776777866968.png';
const output = '/Users/nirdahan/Documents/Projects/bet-joy-league-hub/public/og_image_light.jpg';
// using sips to pad and resize
execSync(`sips -z 630 630 "${input}" --out /tmp/resized.png`);
execSync(`sips -s format jpeg -p 630 1200 --padColor F2F7F2 /tmp/resized.png --out "${output}"`);
console.log("Created", output);
