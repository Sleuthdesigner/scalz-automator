<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_SEO_Manager {
    private static function get_pages(): array {
        return array_map( fn( $p ) => [ 'id' => $p->ID, 'url' => get_permalink( $p->ID ), 'title' => get_the_title( $p->ID ) ],
            get_posts( [ 'post_type' => 'page', 'post_status' => 'publish', 'posts_per_page' => -1 ] ) );
    }
    private static function build_prompt( string $cat, array $vars ): string {
        $tpl = get_option( 'scalz_seo_prompt_' . $cat, '' );
        foreach ( $vars as $k => $v ) { $tpl = str_replace( '{' . $k . '}', $v, $tpl ); }
        return $tpl;
    }
    private static function ai( string $prompt ): string { return class_exists( 'Scalz_Integration_Manager' ) ? Scalz_Integration_Manager::generate( $prompt ) : ''; }
    public static function get_titles(): array { $p = self::get_pages(); foreach ( $p as &$pg ) { $pg['seo_title'] = get_post_meta( $pg['id'], 'rank_math_title', true ) ?: get_the_title( $pg['id'] ); } return $p; }
    public static function generate_titles( array $params ): array {
        $client = $params['client'] ?? []; $updated = $errors = 0; $results = [];
        foreach ( self::get_pages() as $page ) {
            $svc = $client['services'] ?? get_the_title( $page['id'] );
            $gen = self::ai( self::build_prompt( 'page_title', [ 'title' => get_the_title( $page['id'] ), 'service' => is_array( $svc ) ? implode( ', ', $svc ) : $svc, 'city' => $client['city'] ?? '', 'state' => $client['state'] ?? '', 'state_abbr' => $client['state_abbr'] ?? '', 'business_name' => $client['business_name'] ?? '' ] ) );
            if ( $gen ) { update_post_meta( $page['id'], 'rank_math_title', sanitize_text_field( $gen ) ); $updated++; $results[] = [ 'id' => $page['id'], 'title' => $gen, 'status' => 'updated' ]; }
            else { $errors++; $results[] = [ 'id' => $page['id'], 'status' => 'error' ]; }
        }
        return [ 'updated' => $updated, 'errors' => $errors, 'results' => $results ];
    }
    public static function get_descriptions(): array { $p = self::get_pages(); foreach ( $p as &$pg ) { $pg['meta_description'] = get_post_meta( $pg['id'], 'rank_math_description', true ) ?: ''; } return $p; }
    public static function generate_descriptions( array $params ): array {
        $client = $params['client'] ?? []; $updated = $errors = 0; $results = [];
        foreach ( self::get_pages() as $page ) {
            $gen = self::ai( self::build_prompt( 'meta_description', [ 'title' => get_post_meta( $page['id'], 'rank_math_title', true ) ?: get_the_title( $page['id'] ), 'service' => $client['services'] ?? '', 'city' => $client['city'] ?? '', 'state' => $client['state'] ?? '', 'location' => trim( ( $client['city'] ?? '' ) . ' ' . ( $client['state'] ?? '' ) ), 'business_name' => $client['business_name'] ?? '' ] ) );
            if ( $gen ) { update_post_meta( $page['id'], 'rank_math_description', sanitize_text_field( $gen ) ); $updated++; $results[] = [ 'id' => $page['id'], 'description' => $gen, 'status' => 'updated' ]; }
            else { $errors++; $results[] = [ 'id' => $page['id'], 'status' => 'error' ]; }
        }
        return [ 'updated' => $updated, 'errors' => $errors, 'results' => $results ];
    }
    public static function get_focus_keywords(): array { $p = self::get_pages(); foreach ( $p as &$pg ) { $pg['focus_keyword'] = get_post_meta( $pg['id'], 'rank_math_focus_keyword', true ) ?: ''; } return $p; }
    public static function generate_focus_keywords( array $params ): array {
        $client = $params['client'] ?? []; $updated = $errors = 0; $results = [];
        foreach ( self::get_pages() as $page ) {
            $gen = self::ai( "Generate one SEO focus keyword (2-4 words) for a page titled '" . get_the_title( $page['id'] ) . "' for a {$client['niche']} business in {$client['city']}, {$client['state']}. Output only the keyword." );
            if ( $gen ) { update_post_meta( $page['id'], 'rank_math_focus_keyword', sanitize_text_field( trim( $gen ) ) ); $updated++; $results[] = [ 'id' => $page['id'], 'keyword' => $gen, 'status' => 'updated' ]; }
            else { $errors++; $results[] = [ 'id' => $page['id'], 'status' => 'error' ]; }
        }
        return [ 'updated' => $updated, 'errors' => $errors, 'results' => $results ];
    }
    public static function get_alt_tags(): array {
        global $wpdb;
        return array_map( fn( $img ) => [ 'id' => $img->ID, 'url' => $img->guid, 'title' => $img->post_title, 'alt_tag' => get_post_meta( $img->ID, '_wp_attachment_image_alt', true ) ?: '' ],
            $wpdb->get_results( "SELECT ID, post_title, guid FROM {$wpdb->posts} WHERE post_type='attachment' AND post_mime_type LIKE 'image/%' AND post_status='inherit'" ) );
    }
    public static function generate_alt_tags( array $params ): array {
        global $wpdb; $client = $params['client'] ?? []; $updated = $errors = 0; $results = [];
        foreach ( $wpdb->get_results( "SELECT ID, post_title, guid FROM {$wpdb->posts} WHERE post_type='attachment' AND post_mime_type LIKE 'image/%' AND post_status='inherit'" ) as $img ) {
            $svc = $client['services'] ?? $client['niche'] ?? '';
            $gen = self::ai( self::build_prompt( 'alt_tag', [ 'service' => is_array( $svc ) ? implode( ', ', $svc ) : $svc, 'city' => $client['city'] ?? '', 'state' => $client['state'] ?? '', 'state_abbr' => $client['state_abbr'] ?? '', 'business_name' => $client['business_name'] ?? '', 'image_title' => $img->post_title ] ) );
            if ( $gen ) { update_post_meta( $img->ID, '_wp_attachment_image_alt', sanitize_text_field( trim( $gen ) ) ); $updated++; $results[] = [ 'id' => $img->ID, 'alt_tag' => $gen, 'status' => 'updated' ]; }
            else { $errors++; $results[] = [ 'id' => $img->ID, 'status' => 'error' ]; }
        }
        return [ 'updated' => $updated, 'errors' => $errors, 'results' => $results ];
    }
}
