require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { User } = require('../models');

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    if (hidden) {
      rl._writeToOutput = function (text) {
        if (text.includes(question)) rl.output.write(question);
      };
    }

    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const username = await ask('Usuario: ');
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) throw new Error('Ese usuario no existe');

  const password = await ask('Nueva contrasena (minimo 8): ', true);
  if (password.length < 8) throw new Error('Debe tener al menos 8 caracteres');

  user.passwordHash = await bcrypt.hash(password, 12);
  await user.save();
  console.log(`\nContrasena actualizada para ${user.username}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
