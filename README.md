## AI SLOP WARNING
> [!WARNING]
>If you're squeamish about software built largely with AI (so-called "vibecoded"), you might want to look for an alternative, like POEdit.

I was trying to make a translation for my game; firstly, I decided to do it using spreadsheets, but it was kinda unmodular. Then I found out about **gettext** (`.pot`, `.po`), and I really liked its modularity and how well it works with Git... But when I tried to use it with POEdit, it was just inconvenient: to create new keys you would need to edit the `.pot` file in Notepad, and to sync something you needed premium... Fuck it, I don't compromise, I wanna build a program that would help me, not use me.

So, here it is:

# <img src="public/icons/128x128.png" width="32" alt="OpenPOT Icon"> OpenPOT


**OpenPOT** is a modern and fast cross-platform editor for GNU **gettext** (`.po`, `.pot`, `.mo`) localization catalogs, built for game and application developers. Powered by Tauri, React, TypeScript, and Tailwind CSS.

<img width="1917" height="1031" alt="image" src="https://github.com/user-attachments/assets/f6cb1f07-d550-4e58-aed5-35c7ddb09e80" />

### KEY FEATURES:
- **Seamless POT editing** - add a key? No problem. Rename key? Of course! Delete key? We can do that.
<img width="671" height="703" alt="image" src="https://github.com/user-attachments/assets/3dcc36e7-ce67-403f-9938-42311490f9b4" />

- **Multi-Language Matrix** - look at the localization in global scope
<img width="1915" height="799" alt="image" src="https://github.com/user-attachments/assets/bfa2c1ad-259e-4d8b-9203-9a237a5a038d" />

- **Category organization** - stuck while searching your key? Organize your keys with folders and subfolders
<img width="344" height="423" alt="image" src="https://github.com/user-attachments/assets/bc0b5f27-4673-4351-bd73-5c6bca32fc12" />

- **JSON/CSV** - import and export from/to csv and seamless workflow.
<img width="593" height="485" alt="image" src="https://github.com/user-attachments/assets/f925ed3b-9619-46b9-9bdd-2b434a5e8f81" />

- **Native File Management** - direct opening and saving of local project folders without extra browser prompts.
* **Translation Memory (TM)** - Real-time fuzzy matching engine using the Levenshtein distance algorithm.

- **Git integration** - version control management including staging, commits, reverts and diff inspection right inside the app.
<img width="1505" height="952" alt="image" src="https://github.com/user-attachments/assets/c2ebf25e-ce36-4d2c-85f6-4a6ac0c00ae3" />

- **Automatic Compilation** - on-the-fly generation of binary `.mo` files upon saving `.po` catalogs.
<img width="879" height="779" alt="image" src="https://github.com/user-attachments/assets/1be023be-9c31-4487-84b9-75f65b85c1ee" />

- **Plural Forms Support** - interactive plural rules testing for various linguistic families.
<img width="677" height="280" alt="image" src="https://github.com/user-attachments/assets/6e4c0738-a473-4623-8d4d-0b7e5a4031ff" />




## STATE

This project is at its earliest stage; i think the more i maintain it, the less vibecoded garbage there will be. I already know about some bugs and visual errors and they will be addressed.

## STACK

![Tauri](https://img.shields.io/badge/Tauri-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

* **Core/Desktop:** [Tauri](https://tauri.app/) driven by **Rust** (`.rs`) for blazing-fast native file system operations and binary compilation.
* **Frontend:** Built with **React** & **TypeScript** (`.tsx`, `.ts`), styled with **Tailwind CSS**.

If you wanna participate and help clean up the codebase or add new features, i'd be more than happy!

