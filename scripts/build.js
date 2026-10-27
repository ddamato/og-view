import * as esbuild from 'esbuild';

const dev = process.argv.includes('--dev');

/** @type {esbuild.BuildOptions} */
const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  loader: { '.css': 'text' },
  target: 'es2022',
  logLevel: 'info',
};

if (dev) {
  const ctx = await esbuild.context({
    ...shared,
    format: 'iife',
    outfile: 'dev/og-view.iife.js',
    sourcemap: 'inline',
  });
  await ctx.watch();
  await ctx.serve({ servedir: 'dev', port: 8000 });
} else {
  await Promise.all([
    esbuild.build({ ...shared, format: 'esm', outfile: 'dist/og-view.js' }),
    esbuild.build({ ...shared, format: 'iife', outfile: 'dist/og-view.iife.js', minify: true }),
  ]);
}
