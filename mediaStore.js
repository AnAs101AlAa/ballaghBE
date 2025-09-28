const fs = require("fs");
const path = require("path");

const mediaStorePath = path.join(__dirname, "media_store.json");

function loadMediaStore() {
  if (!fs.existsSync(mediaStorePath)) return [];
  const fileContent = fs.readFileSync(mediaStorePath, "utf-8");
  if (!fileContent.trim()) return [];
  try {
    return JSON.parse(fileContent);
  } catch {
    fs.writeFileSync(mediaStorePath, "[]", "utf-8");
    return [];
  }
}

function saveMediaStore(store) {
  fs.writeFileSync(mediaStorePath, JSON.stringify(store, null, 2), "utf-8");
}

module.exports = { loadMediaStore, saveMediaStore };