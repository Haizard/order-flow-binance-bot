# Haizard Misape

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Hosting on Glitch

This project is ready to be hosted on Glitch. Here's how to get it running:

1.  **Remix this project** on Glitch.
2.  **Set up Environment Variables**:
    *   In your Glitch project, create a `.env` file.
    *   Add your `MONGODB_URI` to this file, like so:
        ```
        MONGODB_URI="your_mongodb_connection_string"
        ```
    *   The app will automatically restart to use the new environment variable.
3.  **Wait for Install & Build**: Glitch will automatically run `npm install` and `npm run build` as defined in `glitch.json`. You can check the "Logs" to see the progress.
4.  **Done!** Once the build is complete, your app will be live.
