import { describe, expect, it } from 'vitest'
import { readScorecardCsv, SCORECARD_CSV_TEMPLATE, type ScorecardCsvPlan } from '../scorecard-csv'

// Invented scorecards. Holes 1–18 then total, as the template lays them out.
const HEADER = 'date,course,tee,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,total'
const FRONT = [4, 5, 3, 4, 4, 5, 3, 4, 5] // 37
const BACK = [4, 4, 3, 5, 4, 4, 3, 5, 4] // 36
const row = (date: string, course: string, tee: string, holes: (number | string)[], total: number | string = '') =>
  [date, course, tee, ...Array.from({ length: 18 }, (_, i) => holes[i] ?? ''), total].join(',')
const file = (...lines: string[]) => lines.join('\n') + '\n'

function plan(text: string): ScorecardCsvPlan {
  const read = readScorecardCsv(text)
  if ('rejected' in read) throw new Error(`rejected: ${read.rejected}`)
  return read.plan
}

const scoresOnly = (number: number, score: number) => ({
  number,
  par: null,
  score,
  putts: null,
  penalties: 0,
  fairway_hit: null,
  gir: null,
  shots: [],
  scores_only: 'no_shots',
})

describe('scorecard CSV → planned rounds', () => {
  it('maps an 18-hole and a 9-hole round, scores only, with a stable import id', () => {
    const p = plan(
      file(
        HEADER,
        row('2025-05-09', 'Pine Ridge Golf Club', 'White', [...FRONT, ...BACK], 73),
        row('2025-05-16', 'Prairie Creek', '', FRONT),
      ),
    )
    expect(p.problems).toEqual([])
    expect(p.rounds).toEqual([
      {
        import_id: 'scorecard:2025-05-09:pine-ridge-golf-club',
        course_name: 'Pine Ridge Golf Club',
        played_at: '2025-05-09',
        tee_color: 'white',
        holes: [...FRONT, ...BACK].map((s, i) => scoresOnly(i + 1, s)),
      },
      {
        import_id: 'scorecard:2025-05-16:prairie-creek',
        course_name: 'Prairie Creek',
        played_at: '2025-05-16',
        tee_color: null,
        holes: FRONT.map((s, i) => scoresOnly(i + 1, s)),
      },
    ])
  })

  it('takes a back nine on its own as holes 10–18', () => {
    const p = plan(file(HEADER, row('2025-05-09', 'Pine Ridge', '', ['', '', '', '', '', '', '', '', '', ...BACK], 36)))
    expect(p.problems).toEqual([])
    expect(p.rounds[0]!.holes.map((h) => [h.number, h.score])).toEqual(BACK.map((s, i) => [i + 10, s]))
  })

  it('reads a file with no header row, CRLF line ends and a UTF-8 BOM', () => {
    const p = plan('\uFEFF' + [row('2025-05-09', 'Golfclub Nürnberg', 'Gelb', FRONT, 37), ''].join('\r\n'))
    expect(p.problems).toEqual([])
    expect(p.rounds.map((r) => [r.import_id, r.course_name, r.tee_color, r.holes.length])).toEqual([
      ['scorecard:2025-05-09:golfclub-nürnberg', 'Golfclub Nürnberg', 'gelb', 9],
    ])
  })

  it('reads a header with a BOM in front of it', () => {
    const p = plan('\uFEFF' + file(HEADER, row('2025-05-09', 'Pine Ridge', '', FRONT)))
    expect(p.rounds).toHaveLength(1)
    expect(p.problems).toEqual([])
  })

  it('keeps commas and doubled quotes inside a quoted course name', () => {
    const p = plan(file(HEADER, row('2025-05-09', '"Pebble Beach Golf Links, ""The Links"""', '', FRONT)))
    expect(p.problems).toEqual([])
    expect(p.rounds[0]!.course_name).toBe('Pebble Beach Golf Links, "The Links"')
    expect(p.rounds[0]!.import_id).toBe('scorecard:2025-05-09:pebble-beach-golf-links-the-links')
  })

  it('skips blank lines and still reports the right line numbers', () => {
    const p = plan(
      [HEADER, '', row('2025-05-09', 'Pine Ridge', '', FRONT), '   ', ',,,', row('2025-05-16', 'Pine Ridge', '', ['x', ...FRONT.slice(1)]), ''].join(
        '\n',
      ),
    )
    expect(p.rounds.map((r) => r.played_at)).toEqual(['2025-05-09'])
    expect(p.problems).toEqual([{ line: 6, reason: 'hole 1: “x” isn’t a score (a whole number from 1 to 20)' }])
  })

  it('counts the lines inside a quoted field that spans lines', () => {
    const p = plan(file(HEADER, row('2025-05-09', '"Pine\nRidge"', '', FRONT), row('2025-05-16', 'Pine Ridge', '', ['0', ...FRONT.slice(1)])))
    expect(p.problems.map((x) => x.line)).toEqual([4])
    expect(p.rounds[0]!.course_name).toBe('Pine Ridge')
  })

  it('reports every score cell that isn’t a whole number from 1 to 20, and imports the good rows', () => {
    const bad = (cell: string) => row('2025-05-16', 'Pine Ridge', '', [cell, ...FRONT.slice(1)])
    const p = plan(file(HEADER, row('2025-05-09', 'Pine Ridge', '', FRONT), bad('0'), bad('-1'), bad('4.5'), bad('21'), bad('four')))
    expect(p.rounds.map((r) => r.played_at)).toEqual(['2025-05-09'])
    const why = (c: string) => `hole 1: “${c}” isn’t a score (a whole number from 1 to 20)`
    expect(p.problems).toEqual([
      { line: 3, reason: why('0') },
      { line: 4, reason: why('-1') },
      { line: 5, reason: why('4.5') },
      { line: 6, reason: why('21') },
      { line: 7, reason: why('four') },
    ])
  })

  it('takes a score of 20 and a score with spaces around it', () => {
    const p = plan(file(HEADER, row('2025-05-09', 'Pine Ridge', '', [' 20 ', ...FRONT.slice(1)], 53)))
    expect(p.problems).toEqual([])
    expect(p.rounds[0]!.holes[0]!.score).toBe(20)
  })

  it('reports a total that doesn’t match the holes, and one that isn’t a number', () => {
    const p = plan(
      file(
        HEADER,
        row('2025-05-09', 'Pine Ridge', '', FRONT, 38),
        row('2025-05-16', 'Pine Ridge', '', FRONT, 'abc'),
        row('2025-05-23', 'Pine Ridge', '', FRONT, 37),
      ),
    )
    expect(p.rounds.map((r) => r.played_at)).toEqual(['2025-05-23'])
    expect(p.problems).toEqual([
      { line: 2, reason: 'total 38 doesn’t match the hole scores, which add up to 37' },
      { line: 3, reason: 'total “abc” isn’t a number' },
    ])
  })

  it('reports a hole missing from the nine or eighteen, and a row with no scores', () => {
    const p = plan(
      file(
        HEADER,
        row('2025-05-09', 'Pine Ridge', '', FRONT.slice(0, 8)),
        row('2025-05-16', 'Pine Ridge', '', [...FRONT, 4, '', 3]),
        row('2025-05-23', 'Pine Ridge', '', []),
      ),
    )
    expect(p.rounds).toEqual([])
    expect(p.problems).toEqual([
      { line: 2, reason: 'no score for hole 9' },
      { line: 3, reason: 'no score for holes 11, 13, 14, 15, 16, 17, 18' },
      { line: 4, reason: 'no hole scores' },
    ])
  })

  it('lists every problem on a line together', () => {
    const p = plan(file(HEADER, row('2025-13-01', '', '', ['x', ...FRONT.slice(1)], 1)))
    expect(p.problems).toEqual([
      {
        line: 2,
        reason: 'date “2025-13-01” isn’t a real date; no course name; hole 1: “x” isn’t a score (a whole number from 1 to 20)',
      },
    ])
  })

  describe('dates', () => {
    const at = (date: string) => plan(file(HEADER, row(date, 'Pine Ridge', '', FRONT)))
    it.each([
      ['2025-06-14', '2025-06-14'],
      ['6/14/2025', '2025-06-14'], // month first: 14 can't be a month
      ['14/6/2025', '2025-06-14'], // day first
      ['5/5/2025', '2025-05-05'], // the same either way
      ['2024-02-29', '2024-02-29'],
    ])('reads %s as %s', (date, iso) => {
      const p = at(date)
      expect(p.problems).toEqual([])
      expect(p.rounds[0]!.played_at).toBe(iso)
    })
    it.each([
      ['3/4/2025', 'date “3/4/2025” could be 3 April or 4 March: write it as YYYY-MM-DD'],
      ['2025-02-30', 'date “2025-02-30” isn’t a real date'],
      ['2025-02-29', 'date “2025-02-29” isn’t a real date'],
      ['13/14/2025', 'date “13/14/2025” isn’t a real date'],
      ['6/14/25', 'date “6/14/25” isn’t YYYY-MM-DD'],
      ['June 14 2025', 'date “June 14 2025” isn’t YYYY-MM-DD'],
      ['', 'no date'],
    ])('reports %s', (date, reason) => {
      const p = at(date)
      expect(p.rounds).toEqual([])
      expect(p.problems).toEqual([{ line: 2, reason }])
    })
  })

  describe('the same round twice', () => {
    it('imports a repeated row once and reports the repeat', () => {
      const r = row('2025-05-09', 'Pine Ridge', 'white', FRONT)
      const p = plan(file(HEADER, r, row('2025-05-16', 'Pine Ridge', '', FRONT), r))
      expect(p.rounds.map((x) => x.played_at)).toEqual(['2025-05-09', '2025-05-16'])
      expect(p.problems).toEqual([{ line: 4, reason: 'a repeat of line 2 (same date, course and scores): imported once' }])
    })

    it('imports neither of two rows with the same date and course but different scores', () => {
      const p = plan(
        file(
          HEADER,
          row('2025-05-09', 'Pine Ridge', '', FRONT),
          row('', 'Pine Ridge', '', FRONT),
          row('2025-05-16', 'Pine Ridge', '', FRONT),
          row('2025-05-09', 'pine ridge.', '', [5, ...FRONT.slice(1)]),
        ),
      )
      expect(p.rounds.map((x) => x.played_at)).toEqual(['2025-05-16'])
      const why = 'same date and course as another row, with different scores: remove one; neither is imported'
      // In line order, though the clash is found after every row is read.
      expect(p.problems).toEqual([
        { line: 2, reason: `${why} (line 5)` },
        { line: 3, reason: 'no date' },
        { line: 5, reason: `${why} (line 2)` },
      ])
    })

    it('gives the same row the same import id in another file, so a second import finds it', () => {
      const r = row('2025-05-09', 'Pine Ridge', '', FRONT)
      const a = plan(file(HEADER, r)).rounds[0]!.import_id
      const b = plan(file(HEADER, row('2025-04-01', 'Elsewhere', '', FRONT), r)).rounds[1]!.import_id
      expect(a).toBe('scorecard:2025-05-09:pine-ridge')
      expect(b).toBe(a)
    })
  })

  it('maps a header by column name, in any order', () => {
    const header = ['Course', 'Date', 'Total', ...FRONT.map((_, i) => `Hole ${i + 1}`)].join(',')
    const p = plan(file(header, ['Pine Ridge', '2025-05-09', 37, ...FRONT].join(',')))
    expect(p.problems).toEqual([])
    expect(p.rounds[0]!.holes.map((h) => h.score)).toEqual(FRONT)
    expect(p.rounds[0]!.tee_color).toBeNull()
  })

  it('reports a row with more cells than the header has columns', () => {
    const p = plan(file(HEADER, row('2025-05-09', 'Pine Ridge', '', FRONT) + ',5'))
    expect(p.rounds).toEqual([])
    expect(p.problems).toEqual([
      { line: 2, reason: 'more cells than columns: put a course name with a comma in "quotes"' },
    ])
  })

  it('reports a quote that is never closed', () => {
    const p = plan(file(HEADER, row('2025-05-09', 'Pine Ridge', '', FRONT), row('2025-05-16', '"Pine Ridge', '', FRONT)))
    expect(p.rounds.map((r) => r.played_at)).toEqual(['2025-05-09'])
    expect(p.problems).toEqual([{ line: 3, reason: 'a quote mark is never closed' }])
  })

  it('reports the template’s example rows instead of importing them', () => {
    const p = plan(SCORECARD_CSV_TEMPLATE)
    expect(p.rounds).toEqual([])
    expect(p.problems).toEqual([
      { line: 2, reason: 'an example row from the template: replace it with your own rounds' },
      { line: 3, reason: 'an example row from the template: replace it with your own rounds' },
    ])
  })

  it('has a template whose rows import once they name a real course', () => {
    const p = plan(SCORECARD_CSV_TEMPLATE.replace(/Example Golf Club[^,]*/g, 'Pine Ridge'))
    expect(p.problems).toEqual([])
    expect(p.rounds.map((r) => [r.played_at, r.holes.length, r.holes.reduce((t, h) => t + h.score, 0)])).toEqual([
      ['2025-06-14', 18, 75],
      ['2025-06-21', 9, 41],
    ])
  })

  describe('files it turns away', () => {
    it.each([
      ['an empty file', '', 'This file is empty.'],
      ['only blank lines', '\n\n,,\n', 'This file is empty.'],
      ['a header and no rounds', file(HEADER), 'This file has a header but no rounds.'],
      [
        'semicolons',
        file(HEADER.replaceAll(',', ';')),
        'This file separates its columns with semicolons. Save it with commas (CSV), or start from the template.',
      ],
      [
        'an unknown column',
        file(HEADER.replace('tee', 'tee,par')),
        'The header has a column the template doesn’t: “par”. Remove it or start from the template.',
      ],
      ['a repeated column', file('date,course,1,1'), 'The header has the “1” column twice.'],
      ['no course column', file('date,1,2'), 'The header has no “course” column.'],
      ['no hole columns', file('date,course,tee'), 'The header has no hole columns (1 to 18).'],
      [
        'another app’s header',
        file('player name,date,course name', 'Pat,2025-05-09,Pine Ridge'),
        'The header has a column the template doesn’t: “player name”, “course name”. Remove it or start from the template.',
      ],
      [
        'a first row that is neither a header nor a round',
        file('Pine Ridge,2025-05-09,4,5'),
        'The first row should be the template’s header (date, course, tee, 1 to 18, total) or a round that starts with its date.',
      ],
      [
        'text that wasn’t UTF-8',
        file(HEADER, row('2025-05-09', 'Golfclub N\uFFFDrnberg', '', FRONT)),
        'This file isn’t UTF-8 text. In Excel, save it as “CSV UTF-8 (Comma delimited)”.',
      ],
    ])('%s', (_, text, rejected) => {
      expect(readScorecardCsv(text)).toEqual({ rejected })
    })
  })
})
