import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './src/drizzle/schema/*.ts',
    out: './src/drizzle/migrations',
    dialect: 'postgresql',
    driver: 'pglite',
    dbCredentials: {
        url: './data/dbx.db',
    },
    casing: 'snake_case',
})
