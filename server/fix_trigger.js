import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await client.connect();
  try {
    await client.query(`
      DROP TRIGGER IF EXISTS trg_recompute_hot_score ON votes;
      CREATE TRIGGER trg_recompute_hot_score
      AFTER INSERT OR UPDATE OR DELETE ON votes
      FOR EACH ROW
      EXECUTE FUNCTION recompute_question_hot_score();
    `);
    console.log("Trigger updated successfully.");
  } catch (err) {
    console.error("Error updating trigger:", err);
  } finally {
    await client.end();
  }
}

run();
