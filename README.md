# Salas de Retos

App de salas colaborativas: crea una sala, invita a otros con un código, crea
retos con vencimiento (horas o días) que otorgan puntos al completarse (con
foto de evidencia y aprobación opcional), y canjea esos puntos por
recompensas definidas por la sala. Sirve tanto para parejas ("barrer la
casa" -> noche de videojuegos) como para padres e hijos ("hacer la tarea" ->
puntos para jugar en la compu).

Construida con Expo Router (iOS, Android y web desde un solo código) y
Supabase (auth, base de datos, storage de fotos).

## 1. Crear el proyecto de Supabase

1. Crea un proyecto en https://supabase.com/dashboard (gratis).
2. Ve a **SQL Editor** y pega el contenido completo de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   luego ejecútalo. Esto crea todas las tablas, políticas de seguridad (RLS),
   funciones y el bucket de storage para las fotos.
   - Alternativamente, si tienes la CLI de Supabase instalada:
     `supabase link --project-ref TU_PROJECT_REF` y luego `supabase db push`.
3. Ve a **Project Settings > API** y copia la **Project URL** y la
   **anon public key**.

## 2. Configurar las variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y pega tu URL y anon key de Supabase.

## 3. Instalar y correr

```bash
npm install
npm run web      # navegador
npm run android  # Android (Expo Go o emulador)
npm run ios      # iOS (requiere macOS)
```

## Cómo funciona

- **Salas**: cualquier usuario puede crear una sala (`create_room`) o unirse
  con un código de 6 caracteres (`join_room`).
- **Retos**: cualquier miembro puede crear un reto con puntos y una fecha de
  vencimiento (en horas o días). Puede marcarse "requiere aprobación" (por
  defecto sí) para que otro miembro revise la evidencia antes de otorgar los
  puntos — pensado para el caso padre/hijo. Los retos también pueden ser
  recurrentes.
- **Evidencia**: al marcar un reto como hecho se puede adjuntar una foto
  (cámara o galería), que se sube a Supabase Storage.
- **Aprobación**: el creador del reto o el dueño de la sala aprueban o
  rechazan la evidencia desde la pantalla "Aprobar evidencias". Aprobar
  otorga los puntos.
- **Puntos**: nunca se guardan como un contador editable; se calculan en
  Postgres (vista `room_member_points`) a partir de las evidencias aprobadas
  menos los canjes, para evitar que se puedan falsear desde el cliente.
- **Recompensas**: cualquier miembro puede crear recompensas con un costo en
  puntos. Canjear (`redeem_reward`) valida el saldo en el servidor. El dueño
  de la sala marca los canjes como entregados.

## Estructura

```
app/              pantallas (expo-router, basado en archivos)
  (auth)/         login, registro
  (tabs)/         salas, perfil
  room/[id]/      detalle de sala, crear reto/recompensa, aprobar evidencias
  room/[id]/task/ detalle y completado de un reto
components/UI.tsx componentes reutilizables (Button, Input, Card, Badge)
context/          AuthContext (sesión + perfil)
lib/              cliente de Supabase, tipos, helpers
supabase/         migración SQL (schema + RLS + funciones + storage)
```
