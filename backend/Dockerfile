FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
# Uncomment the next line to set a server-side Gemini API key so frontend users do not
#   need to supply their own, although they still have the option to.
# ENV GEMINI_API_KEY=your-api-key-here

CMD ["bun", "run", "src/index.ts"]
