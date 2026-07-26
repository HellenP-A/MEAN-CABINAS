// Carga todos los modelos para que Mongoose registre sus indices al arrancar
module.exports = {
  Cabin: require('./Cabin'),
  Cleaning: require('./Cleaning'),
  Company: require('./Company'),
  Guest: require('./Guest'),
  Booking: require('./Booking'),
  OccupiedNight: require('./OccupiedNight'),
  Payment: require('./Payment'),
  Setting: require('./Setting'),
  User: require('./User')
};
