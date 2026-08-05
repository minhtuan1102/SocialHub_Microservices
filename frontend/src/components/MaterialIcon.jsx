/**
 * MaterialIcon — Wrapper component for Material Symbols Outlined icon font.
 * Replaces lucide-react icons across the entire app.
 *
 * Usage:
 *   <MaterialIcon name="favorite" />
 *   <MaterialIcon name="favorite" filled className="text-red-500" />
 *   <MaterialIcon name="search" size={20} />
 */
const MaterialIcon = ({ name, className = "", filled = false, size, style = {}, ...rest }) => {
    const combinedStyle = {
        ...style,
        ...(filled ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : {}),
        ...(size ? { fontSize: `${size}px` } : {}),
    };

    return (
        <span
            className={`material-symbols-outlined ${className}`}
            style={combinedStyle}
            {...rest}
        >
            {name}
        </span>
    );
};

export default MaterialIcon;
