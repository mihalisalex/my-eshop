import { config } from "dotenv";

/**
 * Vitest does not read `.env`, so anything needing DATABASE_URL would silently skip.
 * `quiet` because a dotenv banner on every run is noise, and the tests themselves report
 * clearly enough whether they had a database to talk to.
 */
config({ quiet: true });
