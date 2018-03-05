/**
 * S3 File Uploads.
 *
 * A Nxus module for uploading files to AWS S3.
 * It supports direct (client) or processed (server) file uploads.
 *
 * See <https://devcenter.heroku.com/articles/s3> for details on configuring S3 buckets for public use.
 *
 * **Installation**
 *
 *     > npm install nxus-s3-files --save
 *
 * **Module configuration**
 *
 * Configuration is through the `s3-files` nxus configuration entry, which
 * may contain these options:
 *
 *   * `awsKey`: AWS access key
 *   * `awsSecret`: AWS secret access key
 *   * `bucketName`: Default AWS Bucket name. Optional, can be overridden in use.
 *   * `directURL`: Route to define for signing a direct upload request. Optional, can be overriden in use.
 *   * `s3Options`: Options to `aws.
 *
 * **Direct client uploads**
 *
 * In your module, request `app.get('s3-files').getUploadURL().then(({url, js}) => {..}`
 * to define a route for signing direct upload requests. Then use the
 * included js' `S3.getSignedRequest(url, file, filename, callback)`
 * to process a form's file input and send it to S3.
 *
 * **Server side uploads**
 *
 * In your module, reqest `app.get('s3-files').uploadFile(fileName, contents, {Bucket: bucketName})`
 * to send a file to the specified bucket on S3.
 *
 * **A note on bucket names**
 *
 * The file URL returned by the upload uses a "virtual-hosted–style"
 * which includes the bucket name as part of the domain name. For this
 * to work correctly, you need to provide a DNS-compliant bucket name.
 * See <http://docs.aws.amazon.com/AmazonS3/latest/dev/BucketRestrictions.html>
 * for a detailed description of what this means. In somewhat simplified
 * terms: 3-63 characters consisting of lowercase alphabetics (no
 * uppercase), numerics, and hypen (-) characters.
 *
 * ## API
 *
 */
'use strict'

import {NxusModule} from 'nxus-core'
import {router} from 'nxus-router'
import {templater} from 'nxus-templater'

import aws from 'aws-sdk'
import _ from 'underscore'

const fileURLRE = /^https:\/\/(.*?)\.s3\.amazonaws.com\/(.*)$/i

class S3Files extends NxusModule{
  constructor(opts) {
    super(opts)

    router.staticRoute(this.config.directURL+"/js", __dirname+"/js")

    aws.config.update({
      accessKeyId: this.config.awsKey,
      secretAccessKey: this.config.awsSecret
    })
  }

  _defaultConfig() {
    return {
      s3Options: {}
    }
  }
  
  _userConfig() {
    return {
      awsKey: '',
      awsSecret: '',
      bucketName: '',
      directURL: '/s3-direct'
    }
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
    let config = {
      includeScript: false,
      adminOnly: true, 
      ...this.config, 
      ...options
    }
    router.route('GET', config.directURL, _.bind(this._directURLHandler, this, config.bucketName))
    // if (config.adminOnly) {
    //   users.ensureAdmin(config.directURL)
    // }
    let jsURL = this.config.directURL+"/js/s3direct.js"
      // TO DO: is this right? (always uses configured directURL)
    if (config.includeScript) {
      templater.on('renderContext.'+config.includeScript, () => {
        return {scripts: [jsURL]}
      })
    }

    return {url: config.directURL, js: jsURL}
  }

  /**
   * Upload a file to S3.
   * @param {string} filename Name of file on S3.
   * @param {String|Buffer} contents The file contents.
   * @param {object} [s3Options] Additional parameters for S3
   *   `putObject()`. For example, you can specify a `Bucket` parameter
   *   to select the AWS Bucket for the upload, overriding the
   *   configuration setting.
   * @returns {String} URL of uploaded file.
   */
  uploadFile(filename, contents, s3Options={}) {
    let s3 = new aws.S3(this.config.s3Options),
        params = {
          Bucket: this.config.bucketName,
          Key: filename,
          Body: contents,
          Expires: 60,
          ACL: 'public-read',
          ...s3Options}
    return new Promise((resolve, reject) => {
      s3.putObject(params, (err, data) => {
        if (err) { reject(err); return }
        resolve(this.assembleFileURL(params.Key, params.Bucket))
      })
    })
  }

  /** Deletes a file from S3.
   * @param {string} filename Name of the file on S3.
   * @param {object} [s3Options] Additional parameters for S3
   *   `deleteObject()`. For example, you can specify a `Bucket`
   *   parameter to select the AWS Bucket for the delete, overriding the
   *   configuration setting.
   */
  deleteFile(filename, s3Options = {}) {
    let s3 = new aws.S3(this.config.s3Options),
        params = {
          Bucket: this.config.bucketName,
          Key: filename,
          ...s3Options}
    return new Promise((resolve, reject) => {
      s3.deleteObject(params, (err, data) => {
        if (err) { reject(err); return }
        resolve()
      })
    })
  }

  /** Assembles a fully-qualified URL for an S3 file.
   * @param {string} filename Name of file on S3.
   * @param {string} [bucket] Name of bucket in which the file is stored.
   *   If not specified, the default bucket name is used.
   * @returns {string} URL of file.
   */
  assembleFileURL(filename, bucket) {
    return `https://${bucket}.s3.amazonaws.com/${filename}`
  }

  /** Disassembles a fully-qualified URL for an S3 file.
   * @param {string} url URL of file on S3.
   * @returns {Object} Object with `filename` and `bucket` properties.
   *   Undefined if URL could not be parsed as an S3 file specifier.
   */
  disassembleFileURL(url) {
    let m = fileURLRE.exec(url)
    if (m) return {filename: m[2], bucket: m[1]}
  }

  _directURLHandler(bucketName, req, res){
    var s3 = new aws.S3(this.config.s3Options)
    var s3Params = {
      Bucket: bucketName,
      Key: req.query.fileName,
      Expires: 60,
      ContentType: req.query.fileType,
      ACL: 'public-read'
    }
    s3.getSignedUrl('putObject', s3Params, (err, data) => {
      if(err){
        this.log.error(err)
      }
      else{
        var returnData = {
          signed_request: data,
          url: this.assembleFileURL(req.query.fileName, bucketName)
        }
        res.write(JSON.stringify(returnData))
        res.end()
      }
    })
  }
}

const s3files = S3Files.getProxy()
export {S3Files as default, s3files}
