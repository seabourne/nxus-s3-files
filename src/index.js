/**
 * S3 File Uploads
 */

import aws from 'aws-sdk'
import _ from 'underscore'
import Promise from 'bluebird'

/**
 * Support for direct (client) or processed (server) file uploads to AWS S3
 * 
 * See https://devcenter.heroku.com/articles/s3 for details on configuring S3 buckets for public use.
 * 
 * ## Installation
 *
 *    > 
 *
 * ## Config
 *
 *  * `awsKey`: AWS_ACCESS_KEY
 *  * `awsSecret`: AWS_SECRET_ACCESS_KEY
 *  * `bucketName`: S3_BUCKET_NAME, name of AWS Bucket. Optional, can be overridden in use.
 *  * `directURL`: Route to define for signing a direct upload request. Optional, can be overriden in use.
 * 
 * ## Direct client uploads
 * 
 * In your module, request `app.get('s3-files').getUploadURL().then(({url, js}) => {..}`
 * to define a route for signing direct upload requests. Then use the included js' `S3.getSignedRequest(url, file, filename, callback)`
 * to process a form's file input and send it to S3. 
 * 
 * ## Server side uploads
 * 
 * In your module, reqest `app.get('s3-files').uploadFile(fileName, contents, {Bucket: bucketName})` to send a file to the specified bucket on S3.
 * 
 * ## A note on bucket names
 *
 * The file URL returned by the upload uses a "virtual-hosted–style"
 * which includes the bucket name as part of the domain name. For this
 * to work correctly, you need to provide a DNS-compliant bucket name.
 * See http://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html
 * for a detailed description of what this means. In somewhat simplified
 * terms, it means 3-63 characters consisting of lowercase alphabetics
 * (no uppercase), numerics, and hypen (-) characters.
 * 
 */

export default class S3Files {
  constructor(app) {
    const _defaultConfig = {
      awsKey: 'ENV:AWS_ACCESS_KEY',
      awsSecret: 'ENV:AWS_SECRET_ACCESS_KEY',
      bucketName: 'ENV:S3_BUCKET_NAME',
      directURL: '/s3-direct',
    }

    app.writeDefaultConfig('s3-files', _defaultConfig)
    this.config = app.config['s3-files']

    this.app = app
    this.app.get('s3-files').use(this)
      .respond('getUploadURL')
      .respond('uploadFile')

    this.app.get('router').static(this.config.directURL+"/js", __dirname+"/js")
    
    aws.config.update({
      accessKeyId: this.config.awsKey,
      secretAccessKey: this.config.awsSecret
    })
    
  }

  /**
   * Request a URL for uploading directly to an S3 bucket.
   * @param {object} options (optional) Upload configuration options:
   *   bucketName, directURL, includeScript and adminOnly.
   *   Specify bucketName to select the S3 Bucket for the upload,
   *   overriding the configuration setting. Specify directURL to define
   *   the route for signing the upload request, overriding the
   *   configuration setting. Specify includeScript to select a
   *   template name that should include the help script. Set adminOnly
   *   to true to require an admin user for the URL (default), or false
   *   to not require an admin user.
   * @returns {object} url: and js: keys.
   */
  getUploadURL(options) {
    let config = Object.assign({
      includeScript: false,
      adminOnly: true
    }, this.config, options)
    this.app.get('router').route('GET', config.directURL, _.bind(this._directURLHandler, this, config.bucketName))
    if (config.adminOnly) {
      this.app.get('users').ensureAdmin(config.directURL)
    }
    let jsURL = this.config.directURL+"/js/s3direct.js"
      // TO DO: is this right? (always uses configured directURL)
    if (config.includeScript) {
      this.app.get('templater').on('renderContext.'+config.includeScript, () => {
        return {scripts: [jsURL]}
      })
    }

    return {url: config.directURL, js: jsURL}
  }

  /**
   * Upload a file to S3.
   * @param {string} filename Name of file on S3.
   * @param {String|Buffer} contents The file contents.
   * @param {object} [s3Options] Additional parameters for S3 putObject.
   *   For example, you can specify a `Bucket` parameter to select the
   *   AWS Bucket for the upload, overriding the configuration setting.
   * @returns {String} URL of uploaded file.
   */
  uploadFile(filename, contents, s3Options={}) {
    var s3 = new aws.S3()
    Promise.promisifyAll(Object.getPrototypeOf(s3))
    var s3Params = Object.assign({
      Bucket: this.config.bucketName,
      Key: filename,
      Body: contents,
      Expires: 60,
      ACL: 'public-read'
    }, s3Options)
    return s3.putObjectAsync(s3Params).then((data) => {
      return this.fileURL(s3Params.Bucket, s3Params.Key)
    })
  }

  fileURL(bucketName, filename) {
    return 'https://'+bucketName+'.s3.amazonaws.com/'+filename
  }
  
  _directURLHandler(bucketName, req, res){
    var s3 = new aws.S3()
    var s3Params = {
      Bucket: bucketName,
      Key: req.query.fileName,
      Expires: 60,
      ContentType: req.query.fileType,
      ACL: 'public-read'
    }
    s3.getSignedUrl('putObject', s3Params, (err, data) => {
      if(err){
        this.app.log.error(err)
      }
      else{
        var returnData = {
          signed_request: data,
          url: this.fileURL(bucketName, req.query.fileName)
        }
        res.write(JSON.stringify(returnData))
        res.end()
      }
    })
  }
}
