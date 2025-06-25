# Binance Trailblazer

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

## Hosting on Fly.io

This project is ready to be hosted on Fly.io. A `Dockerfile` and `fly.toml` are included.

1.  **Install flyctl**: Follow the instructions on the [Fly.io website](https://fly.io/docs/hands-on/install-flyctl/).
2.  **Launch the app**:
    *   Run `fly launch`. This will detect `fly.toml` and configure your app.
    *   **Do not** deploy yet when prompted.
3.  **Set Secrets**:
    *   Your MongoDB connection string is a secret and should not be in `fly.toml`. Set it using:
        ```sh
        fly secrets set MONGODB_URI="your_mongodb_connection_string"
        ```
4.  **Deploy**:
    *   Run `fly deploy`. `flyctl` will build the Docker image and deploy it to the Fly.io platform.

## Hosting on Render

This project includes a `render.yaml` file to simplify deployment on [Render](https://render.com/).

1.  **Create a Blueprint Instance**:
    *   In your Render dashboard, click "New" -> "Blueprint".
    *   Connect the Git repository for this project.
    *   Render will automatically detect `render.yaml` and configure the service.
2.  **Set Secrets**:
    *   Render will prompt you for any environment variables marked as `sync: false`.
    *   Add your MongoDB connection string for the `MONGODB_URI` variable.
3.  **Deploy**:
    *   Click "Apply" or "Create" to build and deploy your application.
