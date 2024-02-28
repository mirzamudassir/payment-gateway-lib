const fs = require("fs");
const path = require('path');

const dbFilePath = path.join(__dirname, './database/db.json');

async function saveToDatabase(orderDetails) {
    return new Promise((resolve, reject) => {
      fs.readFile(dbFilePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          let db = JSON.parse(data || '[]');
          db.push({ order: orderDetails, timestamp: new Date() });
  
          fs.writeFile(dbFilePath, JSON.stringify(db, null, 2), 'utf8', (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    });
  }

  module.exports = {
    saveToDatabase
  }