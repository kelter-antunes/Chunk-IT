var gulp = require('gulp');
var concat = require('gulp-concat');
var minify = require('gulp-minify');

function minifyjs() {

    return gulp.src(['src/js/*.js'])
    .pipe(concat('chunk-it.min.js'))
    .pipe(minify({
        ext:{
            min:'.js'
        },
        noSource: true
    }))
    .pipe(gulp.dest('dist/build/js'));
}

exports.default = minifyjs;

