'use strict'
import _ from 'underscore'

import S3Files from '../src/'
import {s3files} from '../src/'
import {application} from 'nxus-core'

describe("S3 File Uploads Module", () => {
  describe("Load", () => {
    it("should not be null", () => { expect(S3Files).to.exist })
    it("should be instantiated", () => { expect(s3files).to.exist })
  })
})
