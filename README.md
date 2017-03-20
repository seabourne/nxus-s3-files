## nxus-s3-files

### 

S3 File Uploads.

A Nxus module for uploading files to AWS S3.
It supports direct (client) or processed (server) file uploads.

See <https://devcenter.heroku.com/articles/s3> for details on configuring S3 buckets for public use.

**Installation**

    > npm install nxus-s3-files --save

**Module configuration**

Configuration is through the `s3-files` nxus configuration entry, which
may contain these options:

-   `awsKey`: AWS access key
-   `awsSecret`: AWS secret access key
-   `bucketName`: Default AWS Bucket name. Optional, can be overridden in use.
-   `directURL`: Route to define for signing a direct upload request. Optional, can be overriden in use.

**Direct client uploads**

In your module, request `app.get('s3-files').getUploadURL().then(({url, js}) => {..}`
to define a route for signing direct upload requests. Then use the
included js' `S3.getSignedRequest(url, file, filename, callback)`
to process a form's file input and send it to S3.

**Server side uploads**

In your module, reqest `app.get('s3-files').uploadFile(fileName, contents, {Bucket: bucketName})`
to send a file to the specified bucket on S3.

**A note on bucket names**

The file URL returned by the upload uses a "virtual-hosted–style"
which includes the bucket name as part of the domain name. For this
to work correctly, you need to provide a DNS-compliant bucket name.
See <http://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html>
for a detailed description of what this means. In somewhat simplified
terms: 3-63 characters consisting of lowercase alphabetics (no
uppercase), numerics, and hypen (-) characters.

#### API

### getUploadURL

Request a URL for uploading directly to an S3 bucket.

**Parameters**

-   `options` **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** (optional) Upload configuration options:
      bucketName, directURL, includeScript and adminOnly.
      Specify bucketName to select the S3 Bucket for the upload,
      overriding the configuration setting. Specify directURL to define
      the route for signing the upload request, overriding the
      configuration setting. Specify includeScript to select a
      template name that should include the help script. Set adminOnly
      to true to require an admin user for the URL (default), or false
      to not require an admin user.

Returns **[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** url: and js: keys.

### uploadFile

Upload a file to S3.

**Parameters**

-   `filename` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Name of file on S3.
-   `contents` **([String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) \| [Buffer](https://nodejs.org/api/buffer.html))** The file contents.
-   `s3Options` **\[[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)]** Additional parameters for S3
      `putObject()`. For example, you can specify a `Bucket` parameter
      to select the AWS Bucket for the upload, overriding the
      configuration setting.

Returns **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** URL of uploaded file.

### deleteFile

Deletes a file from S3.

**Parameters**

-   `filename` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Name of the file on S3.
-   `s3Options` **\[[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)]** Additional parameters for S3
      `deleteObject()`. For example, you can specify a `Bucket`
      parameter to select the AWS Bucket for the delete, overriding the
      configuration setting.

### assembleFileURL

Assembles a fully-qualified URL for an S3 file.

**Parameters**

-   `filename` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** Name of file on S3.
-   `bucket` **\[[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)]** Name of bucket in which the file is stored.
      If not specified, the default bucket name is used.

Returns **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** URL of file.

### disassembleFileURL

Disassembles a fully-qualified URL for an S3 file.

**Parameters**

-   `url` **[string](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** URL of file on S3.

Returns **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** Object with `filename` and `bucket` properties.
  Undefined if URL could not be parsed as an S3 file specifier.
