import {
  createRemoteJWKSet,
  jwtVerify,
} from "jose";

/*
|--------------------------------------------------------------------------
| Better Auth JWKS
|--------------------------------------------------------------------------
|
| Better Auth JWT plugin exposes the public keys through:
|
| http://localhost:5000/api/auth/jwks
|
*/

const jwks = createRemoteJWKSet(
  new URL(
    `${process.env.BETTER_AUTH_URL}/api/auth/jwks`
  )
);

/*
|--------------------------------------------------------------------------
| Protect API
|--------------------------------------------------------------------------
*/

export const protect = async (
  req,
  res,
  next
) => {
  try {
    const authorization =
      req.headers.authorization;

    /*
     * Authorization header missing
     */

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization token is required.",
      });
    }

    /*
     * Expected:
     *
     * Authorization: Bearer eyJ...
     */

    const [scheme, token] =
      authorization.split(" ");

    if (
      scheme !== "Bearer" ||
      !token
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authorization format. Use Bearer token.",
      });
    }

    /*
     * Verify JWT
     */

    const { payload } =
      await jwtVerify(
        token,
        jwks,
        {
          issuer:
            process.env.BETTER_AUTH_URL,

          audience:
            process.env.BETTER_AUTH_URL,
        }
      );

    /*
     * Attach authenticated user
     * information to request.
     *
     * These values come from the
     * Better Auth JWT payload.
     */

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name || "",
      photo: payload.photo || "",
    };

    next();
  } catch (error) {
    console.error(
      "JWT verification error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired token.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Role Middleware
|--------------------------------------------------------------------------
*/

export const requireRole = (
  ...allowedRoles
) => {
  return (req, res, next) => {
    /*
     * protect middleware must run first.
     */

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    /*
     * Check role
     */

    if (
      !allowedRoles.includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to access this resource.",
      });
    }

    next();
  };
};