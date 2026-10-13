import { crearApp } from './app';
import { env } from './config/env';

const app = crearApp();

app.listen(env.PORT, () => {
  console.log(`API SGL escuchando en http://localhost:${env.PORT}/api`);
});
