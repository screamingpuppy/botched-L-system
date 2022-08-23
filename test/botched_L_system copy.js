﻿import { ExponentialCost, FirstFreeCost, LinearCost } from "../../api/Costs";
import { Localization } from "../../api/Localization";
import { BigNumber } from "../../api/BigNumber";
import { QuaternaryEntry, theory } from "../../api/Theory";
import { Utils } from "../../api/Utils";

var id = "botched_L_system";
var name = "Botched L-system";
var description = "Your school's laboratory has decided to grow a fictional tree in the data room.\n\nBe careful of its exponential growth, and try to stop it before the database slows down to a crawl and eventually explode in a fatal ERROR.\n\nFurther explanation of L-systems:\nAxiom: the starting sequence\nRules: how the sequence expands each tick\nF: moves cursor forward to create a line\nX: acts like a seed for branches\n-, +: turns cursor left/right\n[, ]: allows for branches, by queueing\ncursor positions on a stack\n\nNote: This theory will not draw a tree based on these rules due to its sheer size.";
var authors = "propfeds#5988 (propsuki)";
var version = 0.6;

var bigNumMat = (array) => array.map((row) => row.map(x => BigNumber.from(x)));

var bigNumList = (array) => array.map(x => BigNumber.from(x));

var idMat = (size) =>
{
    let result = [];
    for(let i = 0; i < size; i++)
    {
        result[i] = [];
        for(let j = 0; j < size; j++)
        {
            if(i == j)
                result[i][j] = BigNumber.ONE;
            else
                result[i][j] = BigNumber.ZERO;
        }
    }
    return result;
}

var matMul = (A, B) =>
    A.map((row, i) =>
        B[0].map((_, j) =>
            row.reduce((acc, _, n) =>
                acc + A[i][n] * B[n][j], BigNumber.ZERO
            )
        )
    )

var matPow = (A, n) =>
{
    // log(n);
    if(n < 1)
        return idMat(A.length);
    if(n == 1)
        return A;
    
    let exp = n;
    let p = 0;
    let result = idMat(A.length);
    while(exp)
    {
        if(rulePowers[p] === undefined)
            rulePowers[p] = matMul(rulePowers[p-1], rulePowers[p-1]);
        if(exp & 1)
            result = matMul(result, rulePowers[p]);
        exp >>= 1;
        p++;
    }
    return result;
}

var updateBitCount = (n) =>
{
    let exp = n;
    let c = 0;
    while(exp)
    {
        if(exp & 1)
            c++;
        exp >>= 1;
    }
    bitCount = c;
}

var printMat = (A) =>
{
    let row = "";
    for(let i = 0; i < A.length; i++)
    {
        for(let j = 0; j < A[i].length; j++)
            row += A[i][j].toString()+" ";
        log(row);
        row = "";
    }
}


var stringTickspeed = "\\text{{" + Localization.get("TheoryPanelTickspeed", "}}q_1q_2\\text{{", "}}{0}\\text{{") + "}}";

// Axiom X
// F --> FF
// X --> F-[[X]+X]+F[+FX]-X
// ø = 22.5
// Symbols: EFX+-[] ([] are not calculated!)

var rho = bigNumMat([[0, 0, 1, 0, 0]]);
var rules = bigNumMat([
    [0, 0, 0, 0, 0],
    [0, 2, 0, 0, 0],
    [0, 3, 4, 3, 2],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1],
]);
var rulePowers = [rules];
var weight = bigNumMat([
    [0.5],
    [0.5],
    [1],
    [0],
    [0]
]);
var weightWithBranch = bigNumMat([
    [0.5],
    [0.5],
    [1],
    [2],
    [2]
]);
var limitedTickspeed = bigNumList([1200, 160, 160]);
var time = 0;
var bitCount = 0;
var currency;
var q1, q2, c1, c2;
var tickLimiter, branchWeight, c1Exp;
var quaternaryEntries = [];


var init = () =>
{
    currency = theory.createCurrency();

    // q1 (Tickspeed)
    // Starts with 0, then goes to 1 and beyond?
    {
        
        let getDesc = (level) => "q_1=" + getQ1(level).toString(0);
        let getDescFlair = (level) => "q_1=" + (level > 0 ? getQ1(level).toString(0) : "\\text{off}");
        q1 = theory.createUpgrade(0, currency, new FirstFreeCost(new ExponentialCost(8, 3)));
        q1.getDescription = (_) => Utils.getMath(getDescFlair(q1.level));
        q1.getInfo = (amount) => Utils.getMathTo(getDesc(q1.level), getDesc(q1.level + amount));
        q1.boughtOrRefunded = (_) => theory.invalidateTertiaryEquation();
        q1.canBeRefunded = (_) => true;
    }
    // q2 (Tickspeed)
    // Literally the same as q1, just more expensive
    {
        let getDesc = (level) => "q_2=2^{" + level + "}";
        let getInfo = (level) => "q_2=" + getQ2(level).toString(0);
        q2 = theory.createUpgrade(1, currency, new ExponentialCost(1e6, Math.log2(1e3)));
        q2.getDescription = (_) => Utils.getMath(getDesc(q2.level));
        q2.getInfo = (amount) => Utils.getMathTo(getInfo(q2.level), getInfo(q2.level + amount));
        q2.boughtOrRefunded = (_) => theory.invalidateTertiaryEquation();
        q2.canBeRefunded = (_) => true;
    }
    // c1
    {
        let getDesc = (level) => "c_1=" + getC1(level).toString(0);
        c1 = theory.createUpgrade(2, currency, new ExponentialCost(1e5, Math.log2(1.6)));
        c1.getDescription = (_) => Utils.getMath(getDesc(c1.level));
        c1.getInfo = (amount) => Utils.getMathTo(getDesc(c1.level), getDesc(c1.level + amount));
        c1.canBeRefunded = (_) => false;
    }
    // c2
    {
        let getDesc = (level) => "c_2=2^{" + level + "}";
        let getInfo = (level) => "c_2=" + getC2(level).toString(0);
        c2 = theory.createUpgrade(3, currency, new ExponentialCost(3e9, 5));
        c2.getDescription = (_) => Utils.getMath(getDesc(c2.level));
        c2.getInfo = (amount) => Utils.getMathTo(getInfo(c2.level), getInfo(c2.level + amount));
        c2.canBeRefunded = (_) => false;
    }

    theory.createPublicationUpgrade(0, currency, 1e8);
    theory.createBuyAllUpgrade(1, currency, 1e16);
    theory.createAutoBuyerUpgrade(2, currency, 1e24);

    // First unlock is at the same stage as auto-buyer
    theory.setMilestoneCost(new LinearCost(16, 16));

    // Tick limiter: locks tickspeed to a certain value.
    // The first level will most likely give a growth boost,
    // but the second level acts more like lag prevention.
    // Lag is the main mechanic of this theory.
    {
        tickLimiter = theory.createMilestoneUpgrade(0, 2);
        tickLimiter.getDescription = (_) => Localization.format("Limits tickspeed to {0}", limitedTickspeed[tickLimiter.level].toString(0));
        tickLimiter.info = "Locks tickspeed regardless of variable levels";
        tickLimiter.boughtOrRefunded = (_) => theory.invalidateTertiaryEquation();
    }

    // Branch weight: gives a flat multiplication bonus.
    {
        branchWeight = theory.createMilestoneUpgrade(1, 1);
        branchWeight.description = Localization.getUpgradeIncCustomDesc("(+)/(-)", "2") + " in weight";
        branchWeight.info = "Raises awareness about the beauty of fractal curves";
        branchWeight.boughtOrRefunded = (_) =>
        {
            theory.invalidateSecondaryEquation();
            theory.invalidateQuaternaryValues();
        }
    }

    // c1 exponent upgrade.
    {
        c1Exp = theory.createMilestoneUpgrade(2, 6);
        c1Exp.description = Localization.getUpgradeIncCustomExpDesc("c_1", "0.02");
        c1Exp.info = Localization.getUpgradeIncCustomExpInfo("c_1", "0.02");
        c1Exp.boughtOrRefunded = (_) => theory.invalidateSecondaryEquation();
    }

    chapter1 = theory.createStoryChapter(0, "The L-system", "'I am very sure.\nWheat this fractal plant, we will be able to attract...\nfunding, for our further research!\n\nNow turn it on, watch it rice, and magic will happen.'", () => true);
    chapter2 = theory.createStoryChapter(1, "Limiter", "My colleague told me that, in case of emergency,\nI should turn this limiter on to slow down the computing.\n\n...Doesn't even work.\nWhy does it actually increase the speed!?", () => tickLimiter.level > 0);
    chapter3 = theory.createStoryChapter(2, "Fractal Exhibition", "Our manager is arranging an exhibition next week,\nto showcase the lab's research on fractal curves.\n\nIs this lady out of her mind?\nOur generation algorithm is barley working...", () => branchWeight.level > 0);
    chapter4 = theory.createStoryChapter(3, "Binary Exponents", "TODO: write a chapter that explains the log2 matrix power algorithm and tells the player why they should aim for a (tickspeed/10) value that has the fewest binary 1 digits in order to not lag the database. Or maybe not? I need to confirm whether this approach actually works.", () => tickLimiter.level > 1);
}

// I copied this from Gilles' T1. Not copyrighted.
var tick = (elapsedTime, multiplier) =>
{
    let tickspeed = getTickspeed(tickLimiter.level);

    if(tickspeed.isZero)
        return;
    
    let timeLimit = 1 / tickspeed.Min(BigNumber.TEN).toNumber();
    time += elapsedTime;

    if(time >= timeLimit - 1e-8)
    {
        let tickPower = tickspeed.toNumber() * time;
        // log(tickPower);

        let bonus = theory.publicationMultiplier * multiplier;
        let vc1 = getC1(c1.level).pow(getC1Exponent(c1Exp.level));
        let vc2 = getC2(c2.level);
        let exp = matPow(rules, Math.round(tickPower));
        rho = matMul(rho, exp);
        currency.value += (matMul(rho, getWeight(branchWeight.level))[0][0]).log2() * bonus * vc1 * vc2;

        time = 0;

        theory.invalidateQuaternaryValues();
    }
}

var getInternalState = () => `${rho[0][0]} ${rho[0][1]} ${rho[0][2]} ${rho[0][3]} ${rho[0][4]} ${time}`

var setInternalState = (state) =>
{
    let values = state.split(" ");
    if(values.length > 0) rho[0][0] = parseBigNumber(values[0]);
    if(values.length > 1) rho[0][1] = parseBigNumber(values[1]);
    if(values.length > 2) rho[0][2] = parseBigNumber(values[2]);
    if(values.length > 3) rho[0][3] = parseBigNumber(values[3]);
    if(values.length > 4) rho[0][4] = parseBigNumber(values[4]);
    if(values.length > 5) time = parseBigNumber(values[5]);
}

var alwaysShowRefundButtons = () =>
{
        return true;
}

var getPrimaryEquation = () =>
{
    let result = "\\begin{matrix}";
    result += "Axiom\:\\text{X}\\\\";
    result += "\\text{F}\\rightarrow{}\\text{FF}\\\\";
    result += "\\text{X}\\rightarrow{}\\text{F-[[X]+X]+F[+FX]-X}";
    result += "\\end{matrix}";

    theory.primaryEquationHeight = 55;
    theory.primaryEquationScale = 0.95;

    return result;
}

var getSecondaryEquation = () =>
{
    let result = "\\begin{matrix}";
    result += "\\dot{\\rho}=c_1";
    if(c1Exp.level == 1) result += "^{1.02}";
    if(c1Exp.level == 2) result += "^{1.04}";
    if(c1Exp.level == 3) result += "^{1.06}";
    if(c1Exp.level == 4) result += "^{1.08}";
    if(c1Exp.level == 5) result += "^{1.10}";
    if(c1Exp.level == 6) result += "^{1.12}";
    result += "c_2\\log_{2}(0.5F+X";
    if(branchWeight.level > 0) result += "+2(+)+2(-)";
    result += ")\\\\";
    result += theory.latexSymbol;
    result += "=\\max\\rho";
    result += "\\end{matrix}";

    // theory.secondaryEquationScale = 0.95;
    theory.secondaryEquationHeight = 32;
    return result;
}

var getTertiaryEquation = () =>
{
    let result = "\\begin{matrix}";
    result += Localization.format(stringTickspeed, getTickspeed(tickLimiter.level).toString(0));
    
    updateBitCount(getTickspeed(0).toNumber());
    result += "\\text{, bits: }";
    result += bitCount.toString();
    result += "\\end{matrix}";

    return result;
}

var getQuaternaryEntries = () =>
{
    if(quaternaryEntries.length == 0)
    {
        quaternaryEntries.push(new QuaternaryEntry("E", null));
        quaternaryEntries.push(new QuaternaryEntry("F", null));
        quaternaryEntries.push(new QuaternaryEntry("X", null));
        quaternaryEntries.push(new QuaternaryEntry("+", null));
        quaternaryEntries.push(new QuaternaryEntry("-", null));
    }

    // if(1 + 2 > 2)
    //     quaternaryEntries[0].value = rho[0][0].toString(0);
    // else
    //     quaternaryEntries[0].value = null;
    quaternaryEntries[1].value = rho[0][1].toString(0);
    quaternaryEntries[2].value = rho[0][2].toString(0);
    if(branchWeight.level > 0)
    {
        quaternaryEntries[3].value = rho[0][3].toString(0);
        quaternaryEntries[4].value = rho[0][4].toString(0);
    }
    else
    {
        quaternaryEntries[3].value = null;
        quaternaryEntries[4].value = null;
    }

    return quaternaryEntries;
}

var getPublicationMultiplier = (tau) => tau.pow(0.192) / BigNumber.FOUR;
var getPublicationMultiplierFormula = (symbol) => "\\frac{{" + symbol + "}^{0.192}}{4}";
var getTau = () => currency.value;
var get2DGraphValue = () => currency.value.sign * (BigNumber.ONE + currency.value.abs()).log10().toNumber();

var postPublish = () =>
{
    time = 0;
    rho = bigNumMat([[0, 0, 1, 0, 0]])
    theory.invalidateTertiaryEquation();
    theory.invalidateQuaternaryValues();
}

var getQ1 = (level) => Utils.getStepwisePowerSum(level, 5, 5, 0);
var getQ2 = (level) => BigNumber.TWO.pow(level);
var getC1 = (level) => Utils.getStepwisePowerSum(level, 3, 6, 1);
var getC1Exponent = (level) => BigNumber.from(1 + 0.02 * level);
var getC2 = (level) => BigNumber.TWO.pow(level);
var getTickspeed = (level) => (level > 0 ? limitedTickspeed[level - 1] : getQ1(q1.level) * getQ2(q2.level));
var getWeight = (level) => (level > 0 ? weightWithBranch : weight);

init();