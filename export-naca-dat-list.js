import nacaDatList from './airfoils/naca-dat-files.js';

function exportJSArray(arr) {
    process.stdout.write('export default [\n ');

    let lineLength = 2;

    for (const item of arr) {

        let output = ` '${item}',`;

        if (lineLength + output.length >= 80) {
            process.stdout.write('\n');
            lineLength = 0;

            output = ' ' + output;
        }

        lineLength += output.length;

        process.stdout.write(output);
    }
    
    process.stdout.write('\n];\n');
}

exportJSArray(nacaDatList);