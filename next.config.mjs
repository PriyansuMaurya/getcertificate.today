import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Pin the Turbopack workspace root to this project. Without this, Turbopack
    // walks up into C:\Users\priya, finds a package-lock.json outside this git
    // repository, and warns that it had to ignore it.
    turbopack: {
        root: path.dirname(fileURLToPath(import.meta.url)),
    },
};

export default nextConfig;
