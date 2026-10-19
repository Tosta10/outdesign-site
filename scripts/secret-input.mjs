import { emitKeypressEvents } from "node:readline";
export async function secretInput(prompt) {
  if (!process.stdin.isTTY)
    throw new Error("請在互動式終端機執行，以安全輸入機密。");
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    function done() {
      process.stdin.off("keypress", keypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    }
    function keypress(text, key = {}) {
      if (key.ctrl && key.name === "c") {
        done();
        reject(new Error("已取消"));
      } else if (key.name === "return" || key.name === "enter") {
        done();
        resolve(value);
      } else if (key.name === "backspace") {
        value = [...value].slice(0, -1).join("");
      } else if (text && !key.ctrl && !key.meta) value += text;
    }
    process.stdin.on("keypress", keypress);
  });
}
