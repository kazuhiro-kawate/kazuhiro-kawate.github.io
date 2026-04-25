<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kazuhiro Kawate - Profile</title>
    
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/MathJax.js?config=TeX-MML-AM_CHTML"></script>

    <style>
        /* ベーススタイル：アカデミックなクリーンさ */
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.8;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background-color: #fff;
        }

        /* ヘッダー：名前と所属 */
        header {
            text-align: center;
            border-bottom: 1px solid #eee;
            padding-bottom: 30px;
            margin-bottom: 40px;
        }
        h1 { margin: 0; font-size: 2.5em; color: #111; }
        .affiliation { font-size: 1.2em; color: #666; margin-top: 10px; }

        /* セクション見出し */
        h2 {
            font-size: 1.6em;
            color: #0056b3; /* 学術的な青 */
            border-left: 5px solid #0056b3;
            padding-left: 15px;
            margin-top: 50px;
            margin-bottom: 20px;
        }

        /* 箇条書きスタイル */
        ul { padding-left: 20px; }
        li { margin-bottom: 10px; }

        /* 研究ノートへのリンク用ボタン */
        .btn-note {
            display: inline-block;
            padding: 10px 20px;
            background-color: #0056b3;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background 0.3s;
        }
        .btn-note:hover { background-color: #004494; }

        /* フッター */
        footer {
            margin-top: 80px;
            text-align: center;
            font-size: 0.9em;
            color: #888;
            border-top: 1px solid #eee;
            padding-top: 20px;
        }
    </style>
</head>
<body>

<header>
    <h1>川手 知拓</h1>
    <div class="affiliation">
        Kazuhiro Kawate<br>
        ZEN University (Student)<br>
        ZEN大学数学会 代表
    </div>
</header>

<main>
    <section>
        <h2>Research Interests（研究分野）</h2>
        <p>
            主に圏論、理論言語学、および量子自然言語処理（QNLP）の境界領域に関心を持っています。
            特に、意味論の構成性を、量子回路モデルを用いてどのように定式化できるかを探求しています。
            （例：$\mathbf{Cat} \to \mathbf{Hilb}$ での関手的な対応など）
        </p>
    </section>

    <section>
        <h2>Publications & Talks（業績）</h2>
        <ul>
            <li>
                <strong>K. Kawate</strong>, "Toward a Categorical Semantics for QNLP," (In preparation).
            </li>
            <li>
                「理論言語学から見た量子計算の可能性」, 前橋数学会セミナー, 2024年10月.
            </li>
            </ul>
    </section>

    <section>
        <h2>History</h2>
        <ul>
            <li>ZEN大学 知能情報社会専攻（在学中）</li>
            <li>日本財団HUMAIプログラム 奨励金B 採択<\li>
            <li>ZEN大学 特待奨学生 採択<\li>
        </ul>
    </section>

    <section>
        <h2>Research Notes（研究ノート）</h2>
        <p>
            学習の備忘録や、よりディープな数学の議論は、以下のMarkdownノートにまとめています。
        </p>
        <p>
            <a href="README.html" class="btn-note">研究ノート（README）を見る</a>
        </p>
    </section>

</main>

<footer>
    Contact: your.email [at] example.com | &copy; 2024 Kazuhiro Kawate
</footer>

</body>
</html>
