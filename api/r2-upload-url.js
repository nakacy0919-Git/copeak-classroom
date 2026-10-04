const {
  S3Client,
  PutObjectCommand
} = require(
  '@aws-sdk/client-s3'
);

const {
  getSignedUrl
} = require(
  '@aws-sdk/s3-request-presigner'
);

const crypto =
  require('crypto');


// ==========================================
// SETTINGS
// ==========================================

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const UPLOAD_URL_SECONDS =
  5 * 60;

const AUDIO_RETENTION_DAYS =
  14;


// ==========================================
// JSON RESPONSE
// ==========================================

function sendJson(
  res,
  status,
  data
) {

  res
    .status(status)
    .json(data);
}


// ==========================================
// SUPABASE TEACHER AUTH
// ==========================================

async function authenticateTeacher(
  req
) {

  const supabaseUrl =
    process.env
      .SUPABASE_URL;

  const publishableKey =
    process.env
      .SUPABASE_PUBLISHABLE_KEY;


  if (
    !supabaseUrl ||
    !publishableKey
  ) {

    throw new Error(
      'Supabase server configuration is missing.'
    );
  }


  const customToken =
  req.headers[
    'x-supabase-access-token'
  ] ||
  '';


const authorization =
  req.headers.authorization ||
  '';


let token =
  '';


if (
  customToken
) {

  token =
    String(
      customToken
    ).trim();

} else if (
  authorization
    .startsWith(
      'Bearer '
    )
) {

  token =
    authorization
      .slice(7)
      .trim();
}


if (
  !token
) {

  return {
    status: 401,
    user: null
  };
}


  // ========================================
  // Supabase AuthでJWTを検証
  // ========================================

  const userResponse =
    await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {

          apikey:
            publishableKey,

          Authorization:
            `Bearer ${token}`

        }
      }
    );


  if (
    !userResponse.ok
  ) {

    return {
      status: 401,
      user: null
    };
  }


  const user =
    await userResponse.json();


  if (
    !user?.id
  ) {

    return {
      status: 401,
      user: null
    };
  }


  // ========================================
  // profiles.roleを確認
  // RLSにより本人のprofileだけ取得可能
  // ========================================

  const profileUrl =
    new URL(
      `${supabaseUrl}/rest/v1/profiles`
    );


  profileUrl.searchParams.set(
    'id',
    `eq.${user.id}`
  );

  profileUrl.searchParams.set(
    'select',
    'role'
  );


  const profileResponse =
    await fetch(
      profileUrl,
      {
        headers: {

          apikey:
            publishableKey,

          Authorization:
            `Bearer ${token}`

        }
      }
    );


  if (
    !profileResponse.ok
  ) {

    return {
      status: 403,
      user: null
    };
  }


  const profiles =
    await profileResponse.json();


  if (
    !Array.isArray(
      profiles
    ) ||
    profiles[0]?.role !==
      'teacher'
  ) {

    return {
      status: 403,
      user: null
    };
  }


  return {
    status: 200,
    user
  };
}


// ==========================================
// VERCEL API
// ==========================================

module.exports =
  async function handler(
    req,
    res
  ) {

    // ======================================
    // POST ONLY
    // ======================================

    if (
      req.method !==
      'POST'
    ) {

      res.setHeader(
        'Allow',
        'POST'
      );

      return sendJson(
        res,
        405,
        {
          error:
            'Method not allowed.'
        }
      );
    }


    try {

      // ====================================
      // ENV CHECK
      // ====================================

      const endpoint =
        process.env
          .R2_ENDPOINT;

      const accessKeyId =
        process.env
          .R2_ACCESS_KEY_ID;

      const secretAccessKey =
        process.env
          .R2_SECRET_ACCESS_KEY;

      const bucket =
        process.env
          .R2_BUCKET_NAME;


      if (
        !endpoint ||
        !accessKeyId ||
        !secretAccessKey ||
        !bucket
      ) {

        return sendJson(
          res,
          500,
          {
            error:
              'R2 server configuration is missing.'
          }
        );
      }


      // ====================================
      // TEACHER AUTH
      // ====================================

      const auth =
        await authenticateTeacher(
          req
        );


      if (
        !auth.user
      ) {

        return sendJson(
          res,
          auth.status,
          {
            error:
              auth.status === 401
                ? 'Authentication required.'
                : 'Teacher access required.'
          }
        );
      }


      // ====================================
      // REQUEST BODY
      // ====================================

      let body =
        req.body || {};


      if (
        typeof body ===
        'string'
      ) {

        body =
          JSON.parse(
            body
          );
      }


      const fileName =
        String(
          body.fileName ||
          ''
        ).trim();


      const contentType =
        String(
          body.contentType ||
          ''
        )
          .trim()
          .toLowerCase();


      const fileSize =
        Number(
          body.fileSize
        );
      // ====================================
      // MP3 / WAV
      // ====================================

      const lowerFileName =
        fileName.toLowerCase();


      const extension =
        lowerFileName.endsWith('.wav')
          ? '.wav'
          : lowerFileName.endsWith('.mp3')
            ? '.mp3'
            : null;


      if (!extension) {

        return sendJson(
          res,
          400,
          {
            error:
              'Only MP3 and WAV files are allowed.'
          }
        );
      }


      const normalizedContentType =
        extension === '.wav'
          ? 'audio/wav'
          : 'audio/mpeg';


      const allowedContentTypes =
        extension === '.wav'
          ? [
              'audio/wav',
              'audio/x-wav',
              'audio/wave',
              'audio/vnd.wave'
            ]
          : [
              'audio/mpeg',
              'audio/mp3'
            ];


      if (
        contentType &&
        !allowedContentTypes.includes(
          contentType
        )
      ) {

        return sendJson(
          res,
          400,
          {
            error:
              'Invalid audio content type.'
          }
        );
      }




      if (
        !Number.isFinite(
          fileSize
        ) ||
        fileSize <= 0 ||
        fileSize >
          MAX_FILE_SIZE
      ) {

        return sendJson(
          res,
          400,
          {
            error:
              'Audio file must be 5 MB or smaller.'
          }
        );
      }


      // ====================================
      // R2 OBJECT KEY
      // Lifecycle prefix:
      // classroom-audio/
      // ====================================

      const objectKey =
        [
          'classroom-audio',
          auth.user.id,
          `${Date.now()}-${crypto.randomUUID()}${extension}`
        ].join('/');


      // ====================================
      // R2 CLIENT
      // ====================================

      const client =
        new S3Client({

          region:
            'auto',

          endpoint,

          credentials: {

            accessKeyId,

            secretAccessKey

          }

        });


      // ====================================
      // PRESIGNED PUT URL
      // ====================================

      const command =
        new PutObjectCommand({

          Bucket:
            bucket,

          Key:
            objectKey,

          ContentType:
            normalizedContentType

        });


      const uploadUrl =
        await getSignedUrl(
          client,
          command,
          {
            expiresIn:
              UPLOAD_URL_SECONDS
          }
        );


      // ====================================
      // CLOUD RETENTION
      // ====================================

      const expiresAt =
        new Date(
          Date.now() +
          AUDIO_RETENTION_DAYS *
          24 *
          60 *
          60 *
          1000
        )
          .toISOString();


      return sendJson(
        res,
        200,
        {

          uploadUrl,

          objectKey,

          contentType:
            normalizedContentType,

          audioExpiresAt:
            expiresAt,

          uploadUrlExpiresIn:
            UPLOAD_URL_SECONDS

        }
      );


    } catch (
      error
    ) {

      console.error(
        '[R2 Upload URL]',
        error
      );


      return sendJson(
        res,
        500,
        {
          error:
            'Could not prepare audio upload.'
        }
      );
    }
  };
