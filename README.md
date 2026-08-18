# AI SLOP WARNING
>If you're squeamish about software built largely with AI (so-called "vibecoded"), you might want to look for an alternative, like POEdit.

I was trying to make a translation for my game; firstly, I decided to do it using spreadsheets, but it was kinda unmodular. Then I found out about **gettext** (`.pot`, `.po`), and I really liked its modularity and how well it works with Git... But when I tried to use it with POEdit, it was just inconvenient: to create new keys you would need to edit the `.pot` file in Notepad, and to sync something you needed premium... Fuck it, I don't compromise, I wanna build a program that would help me, not use me.
So, here it is:

# <img src="public/icons/128x128.png" width="32" alt="OpenPO Icon"> OpenPO


**OpenPO** is a modern and fast cross-platform editor for GNU **gettext** (`.po`, `.pot`, `.mo`) localization catalogs, built for game and application developers. Powered by Tauri, React, TypeScript, and Tailwind CSS.

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


## KEY FEATURES

* **Native File Management**: Direct opening and saving of local project folders without extra browser prompts.
* **Automatic Compilation**: On-the-fly generation of binary `.mo` files upon saving `.po` catalogs.
* **Matrix Editor**: Side-by-side editing of all target languages in a unified table with newline (`\n`) assistance.
* **Translation Memory (TM)**: Real-time fuzzy matching engine using the Levenshtein distance algorithm.
* **Git Integration**: Version control management including staging, commits, reverts and diff inspection right inside the app.
* **Plural Forms Support**: Interactive plural rules testing for various linguistic families.
