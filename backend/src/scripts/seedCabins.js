require('dotenv').config();
const mongoose = require('mongoose');
const { Cabin } = require('../models');

// Capacidad real de cada cabina. Las que no aparecen aqui alojan 2 personas.
const CAPACITIES = { 1: 3, 2: 4, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 15: 7 };
const DEFAULT_CAPACITY = 2;

// Precio por noche: la primera persona paga la base, cada adicional suma el extra
const BASE_PRICE = 15000;
const EXTRA_GUEST_PRICE = 5000;

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  for (let number = 1; number <= 15; number += 1) {
    await Cabin.findOneAndUpdate(
      { code: `C${number}` },
      {
        $set: {
          number,
          name: `Cabina ${number}`,
          capacity: CAPACITIES[number] ?? DEFAULT_CAPACITY,
          basePrice: BASE_PRICE,
          extraGuestPrice: EXTRA_GUEST_PRICE
        },
        $unset: { pricePerGuest: '' }
      },
      { upsert: true }
    );
  }

  const cabins = await Cabin.find().sort({ number: 1 });
  cabins.forEach((c) => console.log(`${c.number}\t${c.name}\t${c.capacity} personas`));
  console.log(`Total: ${cabins.length} cabinas`);

  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
