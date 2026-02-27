<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_Internal_Linker {
    private const INDEX_OPTION  = 'scalz_link_index';
    private const CONFIG_OPTION = 'scalz_link_config';

    private static function default_config(): array {
        return [ 'min_word_count' => 200, 'max_links_per_post' => 5, 'min_similarity' => 0.15, 'exclude_post_ids' => [], 'keyword_rules' => [] ];
    }
    public static function get_config(): array { return wp_parse_args( get_option( self::CONFIG_OPTION, [] ), self::default_config() ); }
    public static function update_config( array $params ): array {
        $config = self::get_config();
        if ( isset( $params['min_word_count'] ) ) $config['min_word_count'] = intval( $params['min_word_count'] );
        if ( isset( $params['max_links_per_post'] ) ) $config['max_links_per_post'] = intval( $params['max_links_per_post'] );
        if ( isset( $params['min_similarity'] ) ) $config['min_similarity'] = (float) $params['min_similarity'];
        if ( isset( $params['exclude_post_ids'] ) && is_array( $params['exclude_post_ids'] ) ) $config['exclude_post_ids'] = array_map( 'intval', $params['exclude_post_ids'] );
        if ( isset( $params['keyword_rules'] ) && is_array( $params['keyword_rules'] ) ) $config['keyword_rules'] = $params['keyword_rules'];
        update_option( self::CONFIG_OPTION, $config );
        return [ 'success' => true, 'config' => $config ];
    }
    public static function index_content(): array {
        $posts = get_posts( [ 'post_type' => [ 'post', 'page' ], 'post_status' => 'publish', 'posts_per_page' => -1 ] );
        $index = [];
        foreach ( $posts as $post ) {
            $terms = self::tokenize( $post->post_title . ' ' . wp_strip_all_tags( $post->post_content ) );
            $index[$post->ID] = [ 'id' => $post->ID, 'title' => $post->post_title, 'url' => get_permalink( $post->ID ), 'tf' => self::term_frequency( $terms ), 'words' => count( $terms ), 'type' => $post->post_type ];
        }
        update_option( self::INDEX_OPTION, $index, false );
        return [ 'indexed' => count( $index ), 'message' => 'Content index updated' ];
    }
    private static function get_index(): array { $i = get_option( self::INDEX_OPTION, [] ); if ( empty( $i ) ) { self::index_content(); $i = get_option( self::INDEX_OPTION, [] ); } return $i; }
    public static function get_suggestions( int $page_id ): array {
        if ( ! $page_id ) return [ 'error' => 'page_id required' ];
        $config = self::get_config(); $index = self::get_index();
        if ( ! isset( $index[$page_id] ) ) { self::index_content(); $index = get_option( self::INDEX_OPTION, [] ); }
        if ( ! isset( $index[$page_id] ) ) return [ 'error' => 'Page not found in index' ];
        $source = $index[$page_id]; $suggestions = []; $existing = self::extract_links( get_post_field( 'post_content', $page_id ) );
        foreach ( $index as $id => $target ) {
            if ( $id === $page_id || in_array( $id, $config['exclude_post_ids'], true ) || $target['words'] < $config['min_word_count'] || in_array( $target['url'], $existing, true ) ) continue;
            $sim = self::cosine_similarity( $source['tf'], $target['tf'] );
            if ( $sim >= $config['min_similarity'] ) $suggestions[] = [ 'target_id' => $id, 'target_title' => $target['title'], 'target_url' => $target['url'], 'similarity' => round( $sim, 4 ), 'anchor_text' => self::suggest_anchor( $source['tf'], $target ) ];
        }
        foreach ( $config['keyword_rules'] as $rule ) {
            $tid = intval( $rule['target_post_id'] ?? 0 );
            if ( ! $tid || ! isset( $index[$tid] ) || in_array( $index[$tid]['url'], $existing, true ) ) continue;
            if ( ! empty( array_filter( $suggestions, fn( $s ) => $s['target_id'] === $tid ) ) ) continue;
            $suggestions[] = [ 'target_id' => $tid, 'target_title' => $index[$tid]['title'], 'target_url' => $index[$tid]['url'], 'similarity' => 1.0, 'anchor_text' => $rule['keyword'], 'rule_based' => true ];
        }
        usort( $suggestions, fn( $a, $b ) => $b['similarity'] <=> $a['similarity'] );
        $suggestions = array_slice( $suggestions, 0, $config['max_links_per_post'] );
        return [ 'source_id' => $page_id, 'source_title' => $source['title'], 'suggestions' => $suggestions, 'total' => count( $suggestions ) ];
    }
    public static function get_report(): array {
        $index = self::get_index(); $config = self::get_config(); $report = [];
        foreach ( $index as $id => $entry ) {
            if ( in_array( $id, $config['exclude_post_ids'], true ) ) continue;
            $outbound = self::extract_links( get_post_field( 'post_content', $id ) ); $inbound = 0; $from = [];
            foreach ( $index as $oid => $other ) { if ( $oid === $id ) continue; if ( in_array( $entry['url'], self::extract_links( get_post_field( 'post_content', $oid ) ), true ) ) { $inbound++; $from[] = $oid; } }
            $sugg = self::get_suggestions( $id ); $sc = is_array( $sugg['suggestions'] ?? null ) ? count( $sugg['suggestions'] ) : 0;
            $report[] = [ 'id' => $id, 'title' => $entry['title'], 'url' => $entry['url'], 'type' => $entry['type'], 'outbound_links' => count( $outbound ), 'inbound_links' => $inbound, 'inbound_from' => $from, 'suggestions' => $sc, 'is_orphan' => $inbound === 0 ];
        }
        usort( $report, fn( $a, $b ) => $a['inbound_links'] <=> $b['inbound_links'] );
        return [ 'total_pages' => count( $report ), 'orphan_pages' => count( array_filter( $report, fn( $r ) => $r['is_orphan'] ) ), 'total_links' => array_sum( array_column( $report, 'outbound_links' ) ), 'total_suggestions' => array_sum( array_column( $report, 'suggestions' ) ), 'pages' => $report ];
    }
    public static function get_orphans(): array {
        $index = self::get_index(); $orphans = [];
        foreach ( $index as $id => $entry ) {
            $has = false;
            foreach ( $index as $oid => $other ) { if ( $oid === $id ) continue; if ( in_array( $entry['url'], self::extract_links( get_post_field( 'post_content', $oid ) ), true ) ) { $has = true; break; } }
            if ( ! $has ) $orphans[] = [ 'id' => $id, 'title' => $entry['title'], 'url' => $entry['url'], 'type' => $entry['type'], 'words' => $entry['words'] ];
        }
        return [ 'orphans' => $orphans, 'total' => count( $orphans ) ];
    }
    public static function apply_links( array $params ): array {
        $links = $params['links'] ?? []; $applied = $errors = 0; $results = [];
        foreach ( $links as $link ) {
            $sid = intval( $link['source_id'] ?? 0 ); $url = esc_url_raw( $link['target_url'] ?? '' ); $anchor = sanitize_text_field( $link['anchor_text'] ?? '' );
            if ( ! $sid || ! $url || ! $anchor ) { $errors++; $results[] = [ 'source_id' => $sid, 'status' => 'error', 'reason' => 'Missing fields' ]; continue; }
            if ( self::inject_link( $sid, $url, $anchor ) ) { $applied++; $results[] = [ 'source_id' => $sid, 'status' => 'applied' ]; } else { $errors++; $results[] = [ 'source_id' => $sid, 'status' => 'error', 'reason' => 'Injection failed' ]; }
        }
        return [ 'applied' => $applied, 'errors' => $errors, 'results' => $results ];
    }
    public static function auto_link( array $params ): array {
        $index = self::get_index(); $config = self::get_config(); $applied = $skipped = $errors = 0;
        foreach ( $index as $id => $entry ) {
            if ( in_array( $id, $config['exclude_post_ids'], true ) ) { $skipped++; continue; }
            $sugg = self::get_suggestions( $id ); if ( empty( $sugg['suggestions'] ) ) continue;
            foreach ( $sugg['suggestions'] as $s ) { self::inject_link( $id, $s['target_url'], $s['anchor_text'] ) ? $applied++ : $errors++; }
        }
        self::index_content();
        return [ 'applied' => $applied, 'skipped' => $skipped, 'errors' => $errors, 'message' => "Auto-linking complete: {$applied} links added" ];
    }
    private static function inject_link( int $post_id, string $url, string $anchor ): bool {
        $content = get_post_field( 'post_content', $post_id );
        if ( empty( $content ) || empty( $anchor ) || str_contains( $content, $url ) ) return false;
        $link = '<a href="' . esc_url( $url ) . '">' . esc_html( $anchor ) . '</a>';
        $new = preg_replace( '/(?<![\w\-">=])(' . preg_quote( $anchor, '/' ) . ')(?![\w\-"<])/i', $link, $content, 1 );
        if ( $new === $content ) return false;
        $r = wp_update_post( [ 'ID' => $post_id, 'post_content' => $new ] );
        return ! is_wp_error( $r ) && $r > 0;
    }
    private static function extract_links( string $content ): array {
        preg_match_all( '/<a[^>]+href=["\']([^"\']+)["\']/i', $content, $m );
        $base = trailingslashit( get_bloginfo( 'url' ) );
        return array_filter( $m[1] ?? [], fn( $u ) => str_starts_with( $u, $base ) || str_starts_with( $u, '/' ) );
    }
    private static function tokenize( string $text ): array {
        $stop = [ 'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','up','about','into','through','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','this','that','these','those','it','its','we','our','you','your','he','she','they','their' ];
        $text = strtolower( wp_strip_all_tags( $text ) ); $text = preg_replace( '/[^a-z0-9\s]/', ' ', $text );
        return array_filter( preg_split( '/\s+/', $text, -1, PREG_SPLIT_NO_EMPTY ), fn( $w ) => strlen( $w ) > 2 && ! in_array( $w, $stop, true ) );
    }
    private static function term_frequency( array $words ): array { $c = array_count_values( $words ); $t = count( $words ) ?: 1; return array_map( fn( $v ) => $v / $t, $c ); }
    private static function cosine_similarity( array $a, array $b ): float {
        $dot = $ma = $mb = 0.0;
        foreach ( $a as $t => $v ) { $dot += $v * ( $b[$t] ?? 0.0 ); $ma += $v * $v; }
        foreach ( $b as $v ) { $mb += $v * $v; }
        $d = sqrt( $ma ) * sqrt( $mb ); return $d > 0 ? $dot / $d : 0.0;
    }
    private static function suggest_anchor( array $source_tf, array $target ): string {
        $words = self::tokenize( $target['title'] ); $candidates = [];
        foreach ( $words as $w ) { if ( isset( $source_tf[$w] ) ) $candidates[$w] = $source_tf[$w]; }
        if ( ! empty( $candidates ) ) { arsort( $candidates ); return array_key_first( $candidates ); }
        return $target['title'];
    }
}
