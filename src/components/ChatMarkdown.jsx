import { Children, isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function cellsFromRow(row) {
  return isValidElement(row) ? Children.toArray(row.props.children).filter(isValidElement) : []
}

function ResponsiveTable({ children }) {
  const sections = Children.toArray(children)
  const head = sections.find(section => isValidElement(section) && section.type === 'thead')
  const body = sections.find(section => isValidElement(section) && section.type === 'tbody')
  const headerRow = isValidElement(head) ? Children.toArray(head.props.children)[0] : null
  const headers = cellsFromRow(headerRow).map(cell => cell.props.children)
  const rows = isValidElement(body) ? Children.toArray(body.props.children) : []

  return <>
    <div className={`markdown-table-scroll ${headers.length && rows.length ? 'has-cards' : ''}`} role="region" aria-label="Chat response table" tabIndex={0}><table>{children}</table></div>
    {headers.length > 0 && rows.length > 0 && <div className="markdown-table-cards">{rows.map((row, rowIndex) => <div className="markdown-table-card" key={rowIndex}>{cellsFromRow(row).map((cell, cellIndex) => <div className="markdown-table-field" key={cellIndex}><span>{headers[cellIndex] ?? `Column ${cellIndex + 1}`}</span><div>{cell.props.children}</div></div>)}</div>)}</div>}
  </>
}

const components = {
  table: ResponsiveTable,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
}

export default function ChatMarkdown({ text }) {
  return <div className="chat-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown></div>
}
