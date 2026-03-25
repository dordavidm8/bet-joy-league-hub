const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://localhost:5432/kickoff',
});

client.connect()
  .then(() => {
    console.log('SUCCESS');
    process.exit(0);
  })
  .catch(err => {
    console.error('FULL ERROR:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    process.exit(1);
  });
