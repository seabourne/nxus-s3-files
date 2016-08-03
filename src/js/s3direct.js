
/*
    Function to carry out the actual PUT request to S3 using the signed request from the app.
*/
var S3 = {
  uploadFile: function(file, signed_request, url, callback){
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", signed_request);
    xhr.setRequestHeader('x-amz-acl', 'public-read');
    xhr.onload = function() {
        if (xhr.status === 200) {
          callback(url);
        }
    };
    xhr.onerror = function() {
        alert("Could not upload file."); 
    };
    xhr.send(file);
  },
/*
    Function to get the temporary signed request from the app.
    If request successful, continue to upload the file using this signed
    request.
*/
  getSignedRequest: function(signURL, file, fileName, callback){
    if (fileName == null) {
      fileName = file.name;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", signURL+"?fileName="+fileName+"&fileType="+file.type);
    xhr.onreadystatechange = function(){
        if(xhr.readyState === 4){
            if(xhr.status === 200){
                var response = JSON.parse(xhr.responseText);
                S3.uploadFile(file, response.signed_request, response.url, callback);
            }
            else{
                alert("Could not get signed URL.");
            }
        }
    };
    xhr.send();
  }
  
};
