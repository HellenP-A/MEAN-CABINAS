require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const { createUser } = require('../services/authService');

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    if (hidden) {
      // Evita que la contrasena quede visible en la terminal
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
  const fullName = await ask('Nombre completo: ');
  const role = (await ask('Rol (admin / reception): ')) || 'reception';
  const password = await ask('Contrasena (minimo 8): ', true);

  const user = await createUser({ username, fullName, password, role });
  console.log(`\nUsuario creado: ${user.username} (${user.role})`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
