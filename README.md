# Monsters CCJ

CREATURE PACKS — TELEGRAM MINI APP



1. CONCEPTO



Crear una Telegram Mini App llamada CREATURE PACKS, inspirada en la emoción de abrir sobres de cartas coleccionables y descubrir criaturas de diferentes rarezas.



La aplicación debe tener una estética moderna, premium y muy visual, diseñada principalmente para teléfonos móviles dentro de Telegram.



La temática debe utilizar criaturas completamente originales. No utilizar nombres, personajes, imágenes, logos ni diseños de Pokémon u otras franquicias existentes.



GRAM será la moneda principal utilizada dentro de la aplicación.



---



2. SISTEMA DE PACKS



Crear 5 tipos principales de sobres.



BASIC PACK



Precio: 0.5 GRAM

Cartas: 5



Probabilidades por carta:



- Common: 70%

- Rare: 23%

- Epic: 6%

- Mythic: 0.9%

- Legendary: 0.1%



PREMIUM PACK



Precio: 1 GRAM

Cartas: 6



Probabilidades:



- Common: 50%

- Rare: 32%

- Epic: 14%

- Mythic: 3.5%

- Legendary: 0.5%



EPIC PACK



Precio: 2 GRAM

Cartas: 7



Probabilidades:



- Common: 32%

- Rare: 35%

- Epic: 23%

- Mythic: 8%

- Legendary: 2%



MYTHIC PACK



Precio: 5 GRAM

Cartas: 8



Probabilidades:



- Common: 15%

- Rare: 30%

- Epic: 30%

- Mythic: 20%

- Legendary: 5%



LEGENDARY PACK



Precio: 10 GRAM

Cartas: 10



Probabilidades:



- Common: 5%

- Rare: 20%

- Epic: 30%

- Mythic: 30%

- Legendary: 15%



Las probabilidades deben aparecer claramente antes de comprar cada pack.



---



3. RAREZAS



Utilizar cinco niveles:



COMMON

RARE

EPIC

MYTHIC

LEGENDARY



Cada rareza debe tener una identidad visual diferente.



COMMON:

Diseño sencillo.



RARE:

Mayor cantidad de efectos visuales.



EPIC:

Brillos y partículas.



MYTHIC:

Animaciones especiales y fondos dinámicos.



LEGENDARY:

Animación de revelación espectacular, partículas, iluminación y efectos holográficos.



---



4. CRIATURAS



Crear inicialmente 30 criaturas originales:



COMMON



- Spriggo

- Flamy

- Aquaff

- Rocko

- Breezi

- Lumby



RARE



- Thornax

- Voltrix

- Aquarion

- Pyron

- Frostel

- Terradon



EPIC



- Inferion

- Stormwing

- Glaciera

- Venomara

- Solaris

- Abyssor



MYTHIC



- Drakoryn

- Celestia

- Netherion

- Chronox

- Titanox

- Astralyn



LEGENDARY



- Elyndor

- Draconis

- Aetherion

- Volcanox

- Lunareth

- Zeraphon



Todos los diseños deben ser originales.



---



5. APERTURA DEL SOBRE



La apertura debe ser una de las partes más importantes de la aplicación.



Flujo:



1. Usuario selecciona PACK.

2. Aparece el sobre en pantalla.

3. Animación de entrada.

4. El sobre comienza a vibrar.

5. Aparecen partículas.

6. El usuario pulsa OPEN.

7. El sobre se abre.

8. Las cartas aparecen una por una.

9. Cada carta tiene una animación diferente según su rareza.

10. Al finalizar aparece el resumen del pack.



Para una Legendary debe existir una animación considerablemente más espectacular que para una Common.



---



6. COLECCIÓN



Crear una sección COLLECTION.



Mostrar:



- Número total de criaturas descubiertas.

- Porcentaje del álbum completado.

- Common descubiertas.

- Rare descubiertas.

- Epic descubiertas.

- Mythic descubiertas.

- Legendary descubiertas.



Crear una cuadrícula de cartas.



Las criaturas todavía no descubiertas deben aparecer como siluetas.



Al pulsar una criatura descubierta:



- Imagen.

- Nombre.

- Rareza.

- Número de colección.

- Descripción.

- Estadísticas.

- Nivel.

- Experiencia.



---



7. DUPLICADOS



Si el usuario obtiene una criatura que ya posee:



Mostrar:



"DUPLICATE"



Los duplicados pueden convertirse en experiencia de colección o utilizarse para mejorar el nivel de esa criatura.



---



8. PERFIL



Crear perfil del jugador con:



- Avatar de Telegram.

- Nombre.

- ID de jugador.

- Nivel.

- XP.

- Total de criaturas.

- Total de Legendary.

- Porcentaje de colección.

- Packs abiertos.



---



9. LEADERBOARD



Crear ranking global.



Categorías:



🏆 Collection Score

👑 Legendary Collection

🔥 Total Creatures

⭐ Player Level



Mostrar Top 100.



Cada jugador debe tener:



- Avatar

- Nombre

- Posición

- Puntuación



---



10. HOME



La pantalla principal debe mostrar:



CREATURE PACKS



"Collect them all."



Mostrar:



- Pack destacado.

- Última criatura conseguida.

- Progreso de colección.

- Botón OPEN PACK.

- Acceso a COLLECTION.

- Acceso a PROFILE.

- Acceso a LEADERBOARD.



Diseño mobile-first.



---



11. DISEÑO VISUAL



Estética:



- Premium

- Fantasía

- Coleccionables

- Holográfica

- Moderna

- Dark mode

- Gradientes

- Glow

- Partículas

- Animaciones suaves



Las cartas deben ser el elemento visual principal.



La interfaz debe sentirse como una combinación entre un álbum de cartas coleccionables y una Mini App moderna de Telegram.



No copiar la interfaz de Pokémon.



---



12. GRAM



GRAM será el medio de pago principal dentro de la aplicación.



Los precios de los packs deben mostrarse siempre en GRAM.



Ejemplo:



BASIC

0.5 GRAM



PREMIUM

1 GRAM



EPIC

2 GRAM



MYTHIC

5 GRAM



LEGENDARY

10 GRAM



Antes de cualquier compra mostrar:



- Precio.

- Número de cartas.

- Rarezas posibles.

- Probabilidades.

- Confirmación de compra.



La aplicación debe utilizar una integración de pago compatible con Telegram y la infraestructura de blockchain correspondiente, dejando la implementación concreta preparada para configurarse posteriormente.



---



13. EXPERIENCIA DEL USUARIO



El objetivo principal es que abrir un pack sea emocionante.



La aplicación debe optimizarse para:



- Cargas rápidas.

- Pantallas pequeñas.

- Animaciones fluidas.

- Navegación sencilla.

- Botones grandes.

- Feedback visual inmediato.



La pantalla de apertura debe ser el elemento estrella de todo el producto.



---



14. ARQUITECTURA



Preparar la aplicación para almacenar:



USER



- telegramId

- username

- avatar

- level

- xp

- collection



CREATURE



- id

- name

- rarity

- description

- image

- stats



PACK



- id

- name

- price

- cardsPerPack

- rarityProbabilities



USER_COLLECTION



- userId

- creatureId

- quantity

- level

- xp



Todas las probabilidades deben estar controladas desde el backend y nunca confiar exclusivamente en JavaScript del cliente.



---



OBJETIVO



Crear una experiencia de apertura de sobres extremadamente atractiva, con criaturas originales, rarezas, colección, progresión, rankings y pagos en GRAM.



La prioridad es:



1. Excelente experiencia móvil.

2. Apertura de sobres espectacular.

3. Sistema de colección.

4. Probabilidades transparentes.

5. Diseño premium.

6. Arquitectura preparada para escalar.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://monstersccj.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e2fc5d41-efed-457b-8a8a-3840e26bbe3e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
