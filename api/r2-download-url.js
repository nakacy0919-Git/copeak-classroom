const {
  S3Client,
  GetObjectCommand
} = require(
  '@aws-sdk/client-s3'
);

const {
  getSignedUrl
} = require(
  '@aws-sdk/s3-request-presigner'
);


const DOWNLOAD_URL_SECONDS =
  5 * 60;


function sendJson(
  res,
  status,
  data
) {

  res
    .status(status)
    .json(data);
}


function getAccessToken(
  req
) {

  const customToken =
    req.headers[
      'x-supabase-access-token'
    ] ||
    '';


  const authorization =
    req.headers.authorization ||
    '';


  if (customToken) {

    return String(
      customToken
    ).trim();
  }


  if (
    authorization.startsWith(
      'Bearer '
    )
  ) {

    return authorization
      .slice(7)
      .trim();
  }


  return '';
}


async function supabaseGet(
  path,
  token
) {

  const supabaseUrl =
    process.env
      .SUPABASE_URL;

  const publishableKey =
    process.env
      .SUPABASE_PUBLISHABLE_KEY;


  const response =
    await fetch(
      `${supabaseUrl}${path}`,
      {
        headers: {

          apikey:
            publishableKey,

          Authorization:
            `Bearer ${token}`

        }
      }
    );


  if (!response.ok) {

    return {
      ok: false,
      data: null
    };
  }


  return {
    ok: true,
    data:
      await response.json()
  };
}


module.exports =
  async function handler(
    req,
    res
  ) {

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

      const {
        assignmentId
      } =
        req.body ||
        {};


      if (!assignmentId) {

        return sendJson(
          res,
          400,
          {
            error:
              'assignmentId is required.'
          }
        );
      }


      const token =
        getAccessToken(
          req
        );


      if (!token) {

        return sendJson(
          res,
          401,
          {
            error:
              'Authentication required.'
          }
        );
      }


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


      // Auth user
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


      if (!userResponse.ok) {

        return sendJson(
          res,
          401,
          {
            error:
              'Invalid session.'
          }
        );
      }


      const user =
        await userResponse.json();


      if (!user?.id) {

        return sendJson(
          res,
          401,
          {
            error:
              'Invalid user.'
          }
        );
      }


      // Student profile
      const profileResult =
        await supabaseGet(
          `/rest/v1/profiles?id=eq.${encodeURIComponent(
            user.id
          )}&select=role`,
          token
        );


      if (
        !profileResult.ok ||
        profileResult.data?.[0]?.role !==
          'student'
      ) {

        return sendJson(
          res,
          403,
          {
            error:
              'Student access required.'
          }
        );
      }


      // Student class memberships
      const memberResult =
        await supabaseGet(
          `/rest/v1/class_members?student_id=eq.${encodeURIComponent(
            user.id
          )}&select=class_id`,
          token
        );


      if (
        !memberResult.ok ||
        !Array.isArray(
          memberResult.data
        )
      ) {

        return sendJson(
          res,
          403,
          {
            error:
              'Class membership could not be verified.'
          }
        );
      }


      const classIds =
        new Set(
          memberResult.data.map(
            row =>
              row.class_id
          )
        );


      // Assignment
      const assignmentResult =
        await supabaseGet(
          `/rest/v1/assignments?id=eq.${encodeURIComponent(
            assignmentId
          )}&select=id,class_id,is_published,audio_object_key,audio_expires_at,audio_file_name`,
          token
        );


      const assignment =
        assignmentResult
          .data?.[0];


      if (
        !assignmentResult.ok ||
        !assignment
      ) {

        return sendJson(
          res,
          404,
          {
            error:
              'Assignment not found.'
          }
        );
      }


      if (
        !classIds.has(
          assignment.class_id
        )
      ) {

        return sendJson(
          res,
          403,
          {
            error:
              'You do not have access to this assignment.'
          }
        );
      }


      if (
        assignment.is_published ===
        false
      ) {

        return sendJson(
          res,
          403,
          {
            error:
              'Assignment is not published.'
          }
        );
      }


      if (
        !assignment.audio_object_key
      ) {

        return sendJson(
          res,
          404,
          {
            error:
              'No audio is attached to this assignment.'
          }
        );
      }


      if (
        assignment.audio_expires_at &&
        new Date(
          assignment.audio_expires_at
        ).getTime() <=
        Date.now()
      ) {

        return sendJson(
          res,
          410,
          {
            error:
              'Cloud audio has expired.'
          }
        );
      }


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

        throw new Error(
          'R2 server configuration is missing.'
        );
      }


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


      const command =
        new GetObjectCommand({

          Bucket:
            bucket,

          Key:
            assignment
              .audio_object_key

        });


      const downloadUrl =
        await getSignedUrl(
          client,
          command,
          {
            expiresIn:
              DOWNLOAD_URL_SECONDS
          }
        );


      return sendJson(
        res,
        200,
        {

          downloadUrl,

          fileName:
            assignment.audio_file_name ||
            'audio.mp3',

          expiresIn:
            DOWNLOAD_URL_SECONDS

        }
      );


    } catch (
      error
    ) {

      console.error(
        '[R2 download URL]',
        error
      );


      return sendJson(
        res,
        500,
        {
          error:
            'Unable to create audio download URL.'
        }
      );
    }
  };