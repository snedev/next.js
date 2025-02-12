import type { AdjustFontFallback } from '../../../../font'
import postcss, { Declaration } from 'postcss'

const postcssFontLoaderPlugn = ({
  exports,
  fontFamilyHash,
  fallbackFonts = [],
  adjustFontFallback,
  variable,
  weight,
  style,
}: {
  exports: { name: any; value: any }[]
  fontFamilyHash: string
  fallbackFonts?: string[]
  adjustFontFallback?: AdjustFontFallback
  variable?: string
  weight?: string
  style?: string
}) => {
  return {
    postcssPlugin: 'postcss-font-loader',
    Once(root: any) {
      let fontFamily: string | undefined

      const normalizeFamily = (family: string) => {
        return family.replace(/['"]/g, '')
      }

      const formatFamily = (family: string) => {
        // Turn the font family unguessable to make it localy scoped
        return `'__${family.replace(/ /g, '_')}_${fontFamilyHash}'`
      }

      // Hash font-family name
      for (const node of root.nodes) {
        if (node.type === 'atrule' && node.name === 'font-face') {
          const familyNode = node.nodes.find(
            (decl: Declaration) => decl.prop === 'font-family'
          )
          if (!familyNode) {
            continue
          }

          const currentFamily = normalizeFamily(familyNode.value)

          if (!fontFamily) {
            fontFamily = currentFamily
          } else if (fontFamily !== currentFamily) {
            throw new Error(
              `Font family mismatch, expected ${fontFamily} but got ${currentFamily}`
            )
          }

          familyNode.value = formatFamily(fontFamily)
        }
      }

      if (!fontFamily) {
        throw new Error('Font loaders must have exactly one font family')
      }

      // Add fallback font with override values
      let adjustFontFallbackFamily: string | undefined
      if (adjustFontFallback) {
        adjustFontFallbackFamily = formatFamily(`${fontFamily} Fallback`)
        const fallbackFontFace = postcss.atRule({ name: 'font-face' })
        const {
          fallbackFont,
          ascentOverride,
          descentOverride,
          lineGapOverride,
          sizeAdjust,
        } = adjustFontFallback
        fallbackFontFace.nodes = [
          new postcss.Declaration({
            prop: 'font-family',
            value: adjustFontFallbackFamily,
          }),
          new postcss.Declaration({
            prop: 'src',
            value: `local("${fallbackFont}")`,
          }),
          ...(ascentOverride
            ? [
                new postcss.Declaration({
                  prop: 'ascent-override',
                  value: ascentOverride,
                }),
              ]
            : []),
          ...(descentOverride
            ? [
                new postcss.Declaration({
                  prop: 'descent-override',
                  value: descentOverride,
                }),
              ]
            : []),
          ...(lineGapOverride
            ? [
                new postcss.Declaration({
                  prop: 'line-gap-override',
                  value: lineGapOverride,
                }),
              ]
            : []),
          ...(sizeAdjust
            ? [
                new postcss.Declaration({
                  prop: 'size-adjust',
                  value: sizeAdjust,
                }),
              ]
            : []),
        ]
        root.nodes.push(fallbackFontFace)
      }

      // Variable fonts can define ranges of values
      const isRange = (value: string) => value.trim().includes(' ')
      const formattedFontFamilies = [
        formatFamily(fontFamily),
        ...fallbackFonts,
        ...(adjustFontFallbackFamily ? [adjustFontFallbackFamily] : []),
      ].join(', ')
      // Add class with family, weight and style
      const classRule = new postcss.Rule({ selector: '.className' })
      classRule.nodes = [
        new postcss.Declaration({
          prop: 'font-family',
          value: formattedFontFamilies,
        }),
        ...(weight && !isRange(weight)
          ? [
              new postcss.Declaration({
                prop: 'font-weight',
                value: weight,
              }),
            ]
          : []),
        ...(style && !isRange(style)
          ? [
              new postcss.Declaration({
                prop: 'font-style',
                value: style,
              }),
            ]
          : []),
      ]
      root.nodes.push(classRule)

      // Add class that defines a variable with the font family
      if (variable) {
        const varialbeRule = new postcss.Rule({ selector: '.variable' })
        varialbeRule.nodes = [
          new postcss.Declaration({
            prop: variable,
            value: formattedFontFamilies,
          }),
        ]
        root.nodes.push(varialbeRule)
      }

      // Export @font-face values as is
      exports.push({
        name: 'style',
        value: {
          fontFamily: formattedFontFamilies,
          fontWeight: !Number.isNaN(Number(weight))
            ? Number(weight)
            : undefined,
          fontStyle: style && !isRange(style) ? style : undefined,
        },
      })
    },
  }
}

postcssFontLoaderPlugn.postcss = true

export default postcssFontLoaderPlugn
