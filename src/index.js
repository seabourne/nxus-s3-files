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
 *  * `bucketName`: Name of AWS Bucket. Optional, can be overridden in use.
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
 * In your module, reqest `app.get('s3-files').uploadFile(bucketName, fileName, contents)` to send a file to the specified bucket on S3.
 * 
 * 
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
   * Request a URL for uploading directly to an S3 bucket
   * @param {String} bucketName S3 Bucket to store files
   * @param {String} [directURL] The URL to register for signing uploads
   * @param {string} [includeScript] Template name that should include the helper script
   * @param {boolean} [adminOnly] Should the URL require an admin user?
   * @returns {object} url: and js: keys.
   */
  getUploadURL(bucketName, directURL, includeScript=false, adminOnly=true) {
    if (directURL === undefined) {
      directURL = this.config.directURL
    }
    this.app.get('router').route('GET', directURL, _.bind(this._directURLHandler, this, bucketName))
    if (adminOnly) {
      this.app.get('users').ensureAdmin(directURL)
    }
    let jsURL = this.config.directURL+"/js/s3direct.js"
    if (includeScript) {
      this.app.get('templater').on('renderContext.'+includeScript, () => {
        return {scripts: [jsURL]}
      })
    }

    return {url: directURL, js: jsURL}
  }

  /**
   * Upload a file to S3
   * @param {String} bucketName S3 Bucket to store files
   * @param {string} filename Name of file on S3
   * @param {String|Buffer} contents The file contents
   * @param {object} [s3Options] Additional parameters for S3 putObject
   * @returns {String} URL of uploaded file
   */
  uploadFile(bucketName, filename, contents, s3Options={}) {
    var s3 = new aws.S3()
    Promise.promisifyAll(Object.getPrototypeOf(s3))
    var s3Params = Object.assign({
      Bucket: bucketName,
      Key: filename,
      Body: contents,
      Expires: 60,
      ACL: 'public-read'
    }, s3Options)
    return s3.putObjectAsync(s3Params).then((data) => {
      return this.fileURL(bucketName, filename)
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
