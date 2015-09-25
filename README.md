Colorcrumble
=============
Source for Colorcrumble. A game of tactics and amazement. Destroy all the color circles for your chance to win!

See beta version here: [colorcrumble.com](http://colorcrumble.com) 

There are currently three different levels implemented which can be seen by going to the following URLS:
 - [colorcrumble.com/basic](http://colorcrumble.com/basic) 
 - [colorcrumble.com/1](http://colorcrumble.com/1) 
 - [colorcrumble.com/2](http://colorcrumble.com/2) 

Setup 
-----------
To run and develop Colorcrumble localy follow these simple steps:

1. Ensure you have an up to date version of node and npm installed.
2. Globally install Gulp: `npm install --global gulp`
3. Install the Go google appengine SDK. Instructions can be found here: [Go Appengine SDK](https://cloud.google.com/appengine/downloads#Google_App_Engine_SDK_for_Go)
4. Run: `npm install`
5. Run: `gulp develop`
5. Run: `goapp serve  -host=0.0.0.0`
6. Colorcrumble will be serving at localhost:8080

