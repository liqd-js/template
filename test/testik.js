const foo = 'var_foo', bar = 'var_bar';
let _RENDER = '', b = 'a';

console.log(`
<div id="442532">
    <div class=${foo}>
        ${bar}
    </div>
</div>
`)

_RENDER += '<div>';
{
    let b = 'c';

    console.log({ b });
}
_RENDER += '<div';

console.log({ b });