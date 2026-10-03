const { execSync } = require('child_process');

try {
  console.log('Menjalankan sync database...');
  execSync('npx -p prisma@5.20.0 prisma db push --skip-generate', { stdio: 'inherit' });
  console.log('Generating client...');
  execSync('npx -p prisma@5.20.0 prisma generate', { stdio: 'inherit' });
} catch (err) {
  console.error('Error:', err.message);
}