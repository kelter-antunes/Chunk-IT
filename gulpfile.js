var gulp = require('gulp');
var concat = require('gulp-concat');
var minify = require('gulp-minify');
var stripDebug = require('gulp-strip-debug');

function minifyjs() {

    return gulp.src(['src/js/*.js'])
    .pipe(concat('chunk-it.min.js'))
    .pipe(stripDebug())
    .pipe(minify({
        ext:{
            min:'.js'
        },
        noSource: true
    }))
    .pipe(gulp.dest('dist/build/js'));
}

exports.default = minifyjs;

