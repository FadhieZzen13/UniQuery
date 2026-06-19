const fs = require('fs');

const data = fs.readFileSync('C:\\Users\\Dhafa Alif\\.gemini\\antigravity-ide\\brain\\77346e53-949b-40e1-bfd7-e79440272cd5\\.system_generated\\logs\\transcript.jsonl', 'utf8');
const lines = data.split('\n').filter(l => l.trim() !== '');

for (const line of lines) {
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'USER_INPUT') {
      console.log('----- USER MESSAGE -----');
      console.log(obj.content);
    }
  } catch (e) {}
}
