import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getCurrentUser } from "@/lib/server-auth";

const f = createUploadthing();

export const ourFileRouter = {
  reportMedia: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    video: { maxFileSize: "32MB", maxFileCount: 1 }
  })
    .middleware(async () => {
      const user = await getCurrentUser();
      if (!user) {
        throw new UploadThingError("Sign in required before uploading report media.");
      }

      return { userId: user.id, role: user.role };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        role: metadata.role,
        url: file.ufsUrl,
        name: file.name
      };
    })
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
