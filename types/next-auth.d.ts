import "next-auth";

declare module "next-auth" {
  interface User {
    username: string;
    role: "ADMIN" | "OPERATOR";
    sedeId: string | null;
  }

  interface Session {
    user: User & {
      id: string;
      name: string;
    };
  }
}

// Augment the JWT type via the re-export
import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    username: string;
    role: "ADMIN" | "OPERATOR";
    sedeId: string | null;
  }
}
